create extension if not exists pgcrypto with schema extensions;
create table public.team_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 email text not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 name text not null check(length(trim(name)) between 1 and 120), role text not null check(role in ('admin','dispatcher','driver','viewer')),
 token_hash text not null unique, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days', accepted_at timestamptz, revoked_at timestamptz
);
create index team_invitation_org_idx on public.team_invitations(organization_id);
create index team_invitation_creator_idx on public.team_invitations(created_by);
alter table public.team_invitations enable row level security;
create policy invitation_admin_read on public.team_invitations for select to authenticated using(private.member_role(organization_id)='admin');
revoke all on public.team_invitations from public,anon,authenticated;
grant select(id,organization_id,email,name,role,created_at,expires_at,accepted_at,revoked_at) on public.team_invitations to authenticated;

create function private.create_team_invitation(p_org uuid,p_email text,p_name text,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; invitation public.team_invitations;
begin
 perform 1 from public.organizations where id=p_org for update;
 if auth.uid() is null or private.member_role(p_org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=p_org and lower(u.email)=lower(trim(p_email))) then raise exception 'Diese Person ist bereits im Team'; end if;
 update public.team_invitations set revoked_at=now() where organization_id=p_org and email=lower(trim(p_email)) and accepted_at is null and revoked_at is null;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.team_invitations(organization_id,email,name,role,token_hash,created_by) values(p_org,lower(trim(p_email)),trim(p_name),p_role,encode(extensions.digest(token,'sha256'),'hex'),auth.uid()) returning * into invitation;
 return jsonb_build_object('token',token,'id',invitation.id,'expires_at',invitation.expires_at);
end $$;

create function private.preview_team_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select jsonb_build_object('organization_name',o.name,'email',i.email,'name',i.name,'role',i.role,'expires_at',i.expires_at) into result
 from public.team_invitations i join public.organizations o on o.id=i.organization_id
 where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and i.revoked_at is null and i.accepted_at is null and i.expires_at>now();
 if result is null then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 return result;
end $$;

create function private.accept_team_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.team_invitations; org uuid; user_email text; confirmed timestamptz;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select organization_id into org from public.team_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 perform 1 from public.organizations where id=org for update;
 select * into i from public.team_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if not found or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() then raise exception 'Einladung ist ungültig oder abgelaufen'; end if;
 select lower(email),email_confirmed_at into user_email,confirmed from auth.users where id=auth.uid();
 if user_email is distinct from i.email or confirmed is null then raise exception 'Bitte mit der bestätigten eingeladenen E-Mail-Adresse anmelden'; end if;
 if not exists(select 1 from public.memberships where organization_id=i.organization_id and user_id=auth.uid()) then
  insert into public.memberships(organization_id,user_id,name,role) values(i.organization_id,auth.uid(),i.name,i.role);
 end if;
 update public.team_invitations set accepted_at=now() where id=i.id;
 return i.organization_id;
end $$;

create function private.revoke_team_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 select organization_id into org from public.team_invitations where id=p_id;
 perform 1 from public.organizations where id=org for update;
 if auth.uid() is null or private.member_role(org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 update public.team_invitations set revoked_at=now() where id=p_id and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Einladung ist nicht mehr offen'; end if;
end $$;

create function private.manage_team_member(p_id uuid,p_expected_role text,p_role text,p_remove boolean) returns void language plpgsql security definer set search_path='' as $$
declare org uuid; m public.memberships;
begin
 select organization_id into org from public.memberships where id=p_id;
 perform 1 from public.organizations where id=org for update;
 if auth.uid() is null or private.member_role(org) is distinct from 'admin' then raise exception 'Administrator erforderlich'; end if;
 select * into m from public.memberships where id=p_id for update;
 if not found then raise exception 'Teammitglied fehlt'; end if;
 if m.role is distinct from p_expected_role then raise exception 'Rolle wurde inzwischen geändert. Bitte neu laden.'; end if;
 if p_remove is null or (not p_remove and (p_role is null or p_role not in ('admin','dispatcher','driver','viewer'))) then raise exception 'Ungültige Rolle'; end if;
 if m.role='admin' and (p_remove or p_role<>'admin') and (select count(*) from public.memberships where organization_id=org and role='admin')<=1 then raise exception 'Mindestens ein Administrator muss erhalten bleiben'; end if;
 -- Lock driver records before checking assignments; assignment validation shares these locks.
 perform 1 from public.drivers where organization_id=org and user_id=m.user_id for update;
 if (p_remove or p_role<>'driver') and exists(select 1 from public.orders o join public.drivers d on d.id=o.driver_id and d.organization_id=o.organization_id where d.organization_id=org and d.user_id=m.user_id and o.status in ('assigned','in_transit')) then raise exception 'Bitte zuerst die offenen Aufträge dieses Fahrers neu zuweisen'; end if;
 if p_remove or p_role<>'driver' then update public.drivers set user_id=null where organization_id=org and user_id=m.user_id; end if;
 if p_remove then delete from public.memberships where id=p_id; else update public.memberships set role=p_role where id=p_id; end if;
end $$;

revoke all on function private.create_team_invitation(uuid,text,text,text),private.preview_team_invitation(text),private.accept_team_invitation(text),private.revoke_team_invitation(uuid),private.manage_team_member(uuid,text,text,boolean) from public;
grant usage on schema private to anon;
grant execute on function private.preview_team_invitation(text) to anon,authenticated;
grant execute on function private.create_team_invitation(uuid,text,text,text),private.accept_team_invitation(text),private.revoke_team_invitation(uuid),private.manage_team_member(uuid,text,text,boolean) to authenticated;
create function public.create_team_invitation(p_org uuid,p_email text,p_name text,p_role text) returns jsonb language sql security invoker set search_path='' as $$ select private.create_team_invitation(p_org,p_email,p_name,p_role) $$;
create function public.preview_team_invitation(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.preview_team_invitation(p_token) $$;
create function public.accept_team_invitation(p_token text) returns uuid language sql security invoker set search_path='' as $$ select private.accept_team_invitation(p_token) $$;
create function public.revoke_team_invitation(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.revoke_team_invitation(p_id) $$;
create function public.manage_team_member(p_id uuid,p_expected_role text,p_role text,p_remove boolean) returns void language sql security invoker set search_path='' as $$ select private.manage_team_member(p_id,p_expected_role,p_role,p_remove) $$;
revoke all on function public.create_team_invitation(uuid,text,text,text),public.preview_team_invitation(text),public.accept_team_invitation(text),public.revoke_team_invitation(uuid),public.manage_team_member(uuid,text,text,boolean) from public,anon;
grant execute on function public.preview_team_invitation(text) to anon,authenticated;
grant execute on function public.create_team_invitation(uuid,text,text,text),public.accept_team_invitation(text),public.revoke_team_invitation(uuid),public.manage_team_member(uuid,text,text,boolean) to authenticated;
