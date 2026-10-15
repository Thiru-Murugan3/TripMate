import { DestinationPhoto } from './destination-overview.component';

/** Destination-level photography is never used to imply a photo of an individual listing. */
export function destinationPhotography(destination: string): DestinationPhoto[] {
  const name=destination.split(',')[0].replace(/\([^)]*\)/g,'').toLowerCase().replace(/[^a-z]/g,'');
  if(!['ooty','udhagamandalam','ootacamund','udagamandalam'].includes(name)) return [];
  return [{url:'destination-photos/ooty-botanical-gardens.jpg',name:'Government Botanical Gardens, Ooty',
    attribution:'Botanical Gardens, Ooty — Jaseem Hamza, 1 June 2010. Responsive display crop.',
    license:'CC BY 3.0',licenseUrl:'https://creativecommons.org/licenses/by/3.0/',
    sourcePage:'https://commons.wikimedia.org/wiki/File:Botanical_Gardens,_Ooty_-_panoramio.jpg'}];
}
