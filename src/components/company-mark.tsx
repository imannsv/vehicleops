'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {Building2} from 'lucide-react';
import {Organization} from '@/lib/domain';
import {companyLogo} from '@/lib/company';
export function CompanyMark({organization,cloud}:{organization:Organization;cloud:boolean}){
 const [logo,setLogo]=useState('');
 useEffect(()=>{let active=true;const refresh=()=>{void companyLogo(organization,cloud).then(url=>{if(active)setLogo(url);}).catch(()=>{if(active)setLogo('');});};refresh();const timer=setInterval(refresh,240000);return()=>{active=false;clearInterval(timer);};},[organization,cloud]);
 return <span className="workspace-icon company-mark">{logo?<Image src={logo} alt={'Logo '+organization.name} width={100} height={60} unoptimized/>:<Building2 size={18}/>}</span>;
}
