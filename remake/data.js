// Aus dem Originalspiel extrahierte Fakten (Bevoelkerung, Haltung, Volksgruppe) plus historische Lage (Naeherung).
// group: 0 Belger, 1 Gallier, 2 Aquitaner, 3 Volcer. attitude = Starthaltung gegenueber Rom (0..10).
// lat/lon: Schwerpunkt des Stammesgebiets zur Zeit Caesars (Naeherung); ox/oy: Kartenposition im Original (Raster 70x65).
const GROUPS=['Belger','Gallier','Aquitaner','Volcer'];
// Projektion: Laengengrad -5.5..10, Breitengrad 42.4..52.2 -> Kartenkoordinaten (Norden oben, Laenge mit cos(47 Grad) gestaucht)
const proj=(lat,lon)=>({x:+((lon+5.5)*4.76).toFixed(1),y:+((52.2-lat)*7).toFixed(1)});
const _T=[
  {id:1,name:'Allobroger',group:3,pop:154392,attitude:6,lat:45.6,lon:5.6,ox:52,oy:56},
  {id:2,name:'Arverner',group:1,pop:114953,attitude:4,lat:45.75,lon:3.1,ox:43,oy:49},
  {id:3,name:'Aulercer',group:1,pop:110424,attitude:3,lat:48.3,lon:0.5,ox:19,oy:21},
  {id:4,name:'Bellovacer',group:0,pop:256230,attitude:2,lat:49.4,lon:2.1,ox:26,oy:9},
  {id:5,name:'Bituriger',group:1,pop:154022,attitude:5,lat:47.1,lon:2.4,ox:25,oy:32},
  {id:6,name:'Cadurcer',group:1,pop:61430,attitude:8,lat:44.5,lon:1.5,ox:16,oy:53},
  {id:7,name:'Carnuten',group:1,pop:54063,attitude:7,lat:48.1,lon:1.7,ox:37,oy:28},
  {id:8,name:'Eburonen',group:0,pop:34912,attitude:3,lat:50.7,lon:5.5,ox:63,oy:5},
  {id:9,name:'Haeduer',group:1,pop:56432,attitude:9,lat:46.9,lon:4.1,ox:43,oy:35},
  {id:10,name:'Helvetier',group:1,pop:209125,attitude:0,lat:47.0,lon:7.9,ox:63,oy:34},
  {id:11,name:'Lemovicer',group:1,pop:36434,attitude:6,lat:45.8,lon:1.3,ox:20,oy:41},
  {id:12,name:'Leucer',group:1,pop:56234,attitude:7,lat:48.6,lon:5.9,ox:61,oy:12},
  {id:13,name:'Lexovier',group:1,pop:34054,attitude:3,lat:49.1,lon:0.2,ox:13,oy:15},
  {id:14,name:'Lingonen',group:1,pop:66403,attitude:6,lat:47.9,lon:5.3,ox:54,oy:22},
  {id:15,name:'Melder',group:0,pop:95215,attitude:3,lat:48.9,lon:2.9,ox:46,oy:13},
  {id:16,name:'Menapier',group:0,pop:48430,attitude:3,lat:51.4,lon:4.7,ox:46,oy:1},
  {id:17,name:'Moriner',group:0,pop:126800,attitude:3,lat:50.7,lon:2.2,ox:29,oy:7},
  {id:18,name:'Osismer',group:1,pop:55363,attitude:3,lat:48.3,lon:-3.8,ox:6,oy:19},
  {id:19,name:'Pictonen',group:1,pop:87056,attitude:5,lat:46.6,lon:0.0,ox:0,oy:31},
  {id:20,name:'Remer',group:0,pop:136781,attitude:10,lat:49.3,lon:4.0,ox:39,oy:10},
  {id:21,name:'Rutener',group:3,pop:95430,attitude:4,lat:44.3,lon:2.6,ox:30,oy:64},
  {id:22,name:'Santonen',group:1,pop:96043,attitude:5,lat:45.7,lon:-0.6,ox:5,oy:40},
  {id:23,name:'Senonen',group:1,pop:34025,attitude:4,lat:48.2,lon:3.3,ox:48,oy:23},
  {id:24,name:'Sequaner',group:1,pop:136460,attitude:6,lat:47.2,lon:6.0,ox:64,oy:26},
  {id:25,name:'Sotiaten',group:2,pop:123045,attitude:3,lat:44.0,lon:0.3,ox:11,oy:58},
  {id:26,name:'Treverer',group:1,pop:49203,attitude:4,lat:49.8,lon:6.6,ox:69,oy:16},
  {id:27,name:'Uneller',group:1,pop:87546,attitude:3,lat:49.2,lon:-1.3,ox:7,oy:13},
  {id:28,name:'Veneter',group:1,pop:67334,attitude:1,lat:47.7,lon:-2.8,ox:0,oy:21},
  {id:29,name:'Vocater',group:2,pop:79645,attitude:3,lat:44.4,lon:-0.4,ox:0,oy:49},
  {id:30,name:'Vocontier',group:3,pop:120323,attitude:6,lat:44.4,lon:5.6,ox:47,oy:64}
];
const TRIBES=_T.map(t=>({...t,...proj(t.lat,t.lon)}));
// Nachbarschaften (gemeinsame Grenzen bzw. direkter Kontakt); Roemische Provinz grenzt an PROVINCE_ADJ
const NEIGHBORS=[[16, 17], [4, 17], [8, 16], [4, 16], [8, 26], [8, 20], [20, 26], [12, 26], [4, 20], [15, 20], [14, 20], [12, 20], [4, 15], [4, 13], [15, 23], [7, 15], [7, 23], [14, 23], [9, 23], [5, 23], [3, 7], [5, 7], [3, 13], [3, 27], [3, 19], [3, 28], [13, 27], [18, 27], [18, 28], [19, 28], [5, 19], [19, 22], [11, 19], [11, 22], [22, 29], [5, 11], [2, 11], [6, 11], [5, 9], [2, 5], [9, 14], [9, 24], [2, 9], [1, 9], [14, 24], [12, 14], [12, 24], [10, 24], [1, 24], [1, 10], [1, 30], [1, 2], [2, 30], [2, 21], [2, 6], [6, 21], [21, 25], [6, 25], [25, 29]];
const PROVINCE_ADJ=[1, 30, 21, 2, 25, 10];
const LEGION_START={...proj(43.5,4.3),name:'Provincia Romana (Nemausus)'};
if(typeof module!=='undefined')module.exports={GROUPS,LEGION_START,TRIBES,NEIGHBORS,PROVINCE_ADJ,proj};
