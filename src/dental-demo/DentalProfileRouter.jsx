import ClinicalProfile from './ClinicalProfile';
import DentalProfile from './DentalProfile';
export default function DentalProfileRouter(){return /^\/clinica-dental(?:\/|$)/.test(window.location.pathname)||new URLSearchParams(window.location.search).get('client')==='clinica-dental'?<ClinicalProfile/>:<DentalProfile/>;}
