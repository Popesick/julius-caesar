// Aus dem Originalspiel extrahierte Fakten (tools/reverse.py -> analysis/tribes.json).
// group: 0 Belger, 1 Gallier, 2 Aquitaner, 3 Volcer. attitude = Starthaltung gegenueber Rom (0..10).
// x/y: Kartenposition im Raster 0..69 x 0..64 (Norden oben).
const GROUPS=['Belger','Gallier','Aquitaner','Volcer'];
const LEGION_START={x:65,y:60};
const TRIBES=[
  {id:1,name:'Allobroger',group:3,pop:154392,attitude:6,slot:30,x:52,y:56},
  {id:2,name:'Arverner',group:1,pop:114953,attitude:4,slot:22,x:43,y:49},
  {id:3,name:'Aulercer',group:1,pop:110424,attitude:3,slot:12,x:19,y:21},
  {id:4,name:'Bellovacer',group:0,pop:256230,attitude:2,slot:2,x:26,y:9},
  {id:5,name:'Bituriger',group:1,pop:154022,attitude:5,slot:14,x:25,y:32},
  {id:6,name:'Cadurcer',group:1,pop:61430,attitude:8,slot:23,x:16,y:53},
  {id:7,name:'Carnuten',group:1,pop:54063,attitude:7,slot:13,x:37,y:28},
  {id:8,name:'Eburonen',group:0,pop:34912,attitude:3,slot:6,x:63,y:5},
  {id:9,name:'Haeduer',group:1,pop:56432,attitude:9,slot:16,x:43,y:35},
  {id:10,name:'Helvetier',group:1,pop:209125,attitude:0,slot:21,x:63,y:34},
  {id:11,name:'Lemovicer',group:1,pop:36434,attitude:6,slot:25,x:20,y:41},
  {id:12,name:'Leucer',group:1,pop:56234,attitude:7,slot:18,x:61,y:12},
  {id:13,name:'Lexovier',group:1,pop:34054,attitude:3,slot:9,x:13,y:15},
  {id:14,name:'Lingonen',group:1,pop:66403,attitude:6,slot:17,x:54,y:22},
  {id:15,name:'Melder',group:0,pop:95215,attitude:3,slot:5,x:46,y:13},
  {id:16,name:'Menapier',group:0,pop:48430,attitude:3,slot:3,x:46,y:1},
  {id:17,name:'Moriner',group:0,pop:126800,attitude:3,slot:1,x:29,y:7},
  {id:18,name:'Osismer',group:1,pop:55363,attitude:3,slot:7,x:6,y:19},
  {id:19,name:'Pictonen',group:1,pop:87056,attitude:5,slot:11,x:0,y:31},
  {id:20,name:'Remer',group:0,pop:136781,attitude:10,slot:4,x:39,y:10},
  {id:21,name:'Rutener',group:3,pop:95430,attitude:4,slot:28,x:30,y:64},
  {id:22,name:'Santonen',group:1,pop:96043,attitude:5,slot:24,x:5,y:40},
  {id:23,name:'Senonen',group:1,pop:34025,attitude:4,slot:15,x:48,y:23},
  {id:24,name:'Sequaner',group:1,pop:136460,attitude:6,slot:20,x:64,y:26},
  {id:25,name:'Sotiaten',group:2,pop:123045,attitude:3,slot:27,x:11,y:58},
  {id:26,name:'Treverer',group:1,pop:49203,attitude:4,slot:19,x:69,y:16},
  {id:27,name:'Uneller',group:1,pop:87546,attitude:3,slot:8,x:7,y:13},
  {id:28,name:'Veneter',group:1,pop:67334,attitude:1,slot:10,x:0,y:21},
  {id:29,name:'Vocater',group:2,pop:79645,attitude:3,slot:26,x:0,y:49},
  {id:30,name:'Vocontier',group:3,pop:120323,attitude:6,slot:29,x:47,y:64}
];
if(typeof module!=='undefined')module.exports={GROUPS,LEGION_START,TRIBES};
