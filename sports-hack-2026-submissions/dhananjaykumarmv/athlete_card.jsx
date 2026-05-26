import { useState } from "react";

const fmt = n => n >= 1e9 ? (n/1e9).toFixed(1)+"B" : n >= 1e6 ? (n/1e6).toFixed(0)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : n;

const FLAG = { Portugal:"🇵🇹", France:"🇫🇷", Argentina:"🇦🇷", Serbia:"🇷🇸", USA:"🇺🇸", Global:"🌍", Brazil:"🇧🇷" };
const TDIR = { rising:"↑ Rising", stable:"→ Stable", declining:"↓ Declining" };
const TCOL = { rising:"#4ade80", stable:"#fbbf24", declining:"#f87171" };

const SPORT_CFG = {
  Soccer:          { emoji:"⚽", gradient:["#0d4f1c","#1a8c35","#072b10"], accent:"#4ade80" },
  Basketball:      { emoji:"🏀", gradient:["#7c2d00","#ea580c","#431900"], accent:"#fb923c" },
  Tennis:          { emoji:"🎾", gradient:["#4a0d8f","#9333ea","#2d0660"], accent:"#c084fc" },
  "American Football":{ emoji:"🏈", gradient:["#1e3a5f","#2563eb","#0f1f3d"], accent:"#60a5fa" },
};

const PLAYERS = [
  { name:"Cristiano Ronaldo", short:"RONALDO", position:"Forward", rank:3,
    team:"Al-Nassr", nationality:"Portugal", age:41, sport:"Soccer",
    image:"https://upload.wikimedia.org/wikipedia/commons/9/9c/President_Donald_Trump_meets_with_Cristiano_Ronaldo_in_the_Oval_Office_%2854933344262%29_%28cropped_and_rotated%29.jpg",
    bio:"Nicknamed CR7, widely regarded as one of the greatest footballers ever. Five-time Ballon d'Or winner and record scorer with a global audience of billions.",
    brand_score:86.8, tier:"Elite Influencer",
    ig:625e6, ig_eng:2.1, tt:22e6, tt_views:18.2, fb:168e6, yt:65e6, yt_views:12.4,
    fb_regions:"Portugal 10% · Brazil 18% · India 12%",
    trend:45, trend_dir:"declining", market_value:152.6,
    sub:{social:100,eng:100,trend:37,spon:100,val:93.7},
    sponsors:["Nike","Binance","Herbalife","Tag Heuer"] },
  { name:"Kylian Mbappé", short:"MBAPPÉ", position:"Forward", rank:1,
    team:"Real Madrid", nationality:"France", age:27, sport:"Soccer",
    image:"https://upload.wikimedia.org/wikipedia/commons/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg",
    bio:"One of the best players in the world, known for pace, dribbling and clinical finishing. World Cup winner and the face of a new generation of football.",
    brand_score:85.7, tier:"Elite Influencer",
    ig:110e6, ig_eng:3.2, tt:45e6, tt_views:8.2, fb:28e6, yt:12e6, yt_views:4.1,
    fb_regions:"France 25% · Brazil 12% · Morocco 10%",
    trend:33, trend_dir:"rising", market_value:171.2,
    sub:{social:90,eng:100,trend:41,spon:100,val:100},
    sponsors:["Nike","Hublot","EA Sports","Dior"] },
  { name:"Lionel Messi", short:"MESSI", position:"Forward", rank:2,
    team:"Inter Miami", nationality:"Argentina", age:38, sport:"Soccer",
    image:"https://upload.wikimedia.org/wikipedia/commons/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",
    bio:"The most decorated player in football history. Eight Ballon d'Or awards. World Cup champion 2022. Currently captains Inter Miami in MLS.",
    brand_score:84.3, tier:"Elite Influencer",
    ig:503e6, ig_eng:2.8, tt:12e6, tt_views:15.5, fb:116e6, yt:8.5e6, yt_views:5.8,
    fb_regions:"Argentina 20% · India 15% · USA 12%",
    trend:42, trend_dir:"stable", market_value:74.7,
    sub:{social:100,eng:100,trend:42,spon:100,val:58.6},
    sponsors:["Adidas","Pepsi","Apple","Mastercard"] },
  { name:"LeBron James", short:"LEBRON", position:"Small Forward", rank:1,
    team:"LA Lakers", nationality:"Global", age:41, sport:"Basketball",
    image:"https://upload.wikimedia.org/wikipedia/commons/7/7a/LeBron_James_%2851959977144%29_%28cropped2%29.jpg",
    bio:"NBA all-time leading scorer and 4x champion. Beyond basketball, LeBron built SpringHill Entertainment — the most business-savvy athlete alive.",
    brand_score:83.2, tier:"Elite Influencer",
    ig:159e6, ig_eng:1.9, tt:11e6, tt_views:5.4, fb:29e6, yt:0.5e6, yt_views:1.1,
    fb_regions:"USA 65% · Philippines 10% · Canada 5%",
    trend:69, trend_dir:"stable", market_value:57.1,
    sub:{social:90.3,eng:89.3,trend:69,spon:100,val:50.7},
    sponsors:["Nike","PepsiCo","AT&T","Beats by Dre"] },
  { name:"Novak Djokovic", short:"DJOKOVIC", position:"Player", rank:1,
    team:"ATP Tour", nationality:"Serbia", age:39, sport:"Tennis",
    image:"https://upload.wikimedia.org/wikipedia/commons/d/d7/Novak_Djokovic_2024_Paris_Olympics.jpg",
    bio:"Record 24 Grand Slam titles and ATP No. 1 for 428 weeks. The most successful men's singles player in tennis history.",
    brand_score:78.6, tier:"Major Star",
    ig:14.5e6, ig_eng:3.1, tt:0.8e6, tt_views:1.8, fb:10e6, yt:0.19e6, yt_views:0.4,
    fb_regions:"Serbia 30% · Italy 12% · France 8%",
    trend:87, trend_dir:"stable", market_value:9.6,
    sub:{social:68.5,eng:90.2,trend:87,spon:94,val:29.3},
    sponsors:["Lacoste","Asics","Head","Hublot"] },
  { name:"Micah Parsons", short:"PARSONS", position:"Linebacker", rank:1,
    team:"Green Bay Packers", nationality:"USA", age:27, sport:"American Football",
    image:"https://upload.wikimedia.org/wikipedia/commons/f/f8/2025_Commanders_at_Packers_Micah_Parsons_%28cropped%29.jpg",
    bio:"Dominant pass-rusher and one of the NFL's most electrifying defensive players. Rising brand with a 97/100 trend score — the hottest name in football.",
    brand_score:78.1, tier:"Major Star",
    ig:6.3e6, ig_eng:5.4, tt:2.4e6, tt_views:1.1, fb:3.2e6, yt:0.127e6, yt_views:2.2,
    fb_regions:"USA 92% · Canada 5% · Germany 2%",
    trend:97, trend_dir:"rising", market_value:18.2,
    sub:{social:60.7,eng:100,trend:100,spon:64,val:33.2},
    sponsors:["Under Armour","Mercedes-Benz","Apple","Bud Light"] },
  { name:"Stephen Curry", short:"CURRY", position:"Point Guard", rank:4,
    team:"Golden State Warriors", nationality:"Global", age:38, sport:"Basketball",
    image:"https://upload.wikimedia.org/wikipedia/commons/5/52/Stephen_Curry%2C_Olympic_Games_2024_%28cropped%29.jpg",
    bio:"Revolutionised basketball with the 3-point shot. 4x NBA champion. Olympic gold medalist. One of the most recognisable athletes in the world.",
    brand_score:74.6, tier:"Major Star",
    ig:56e6, ig_eng:2.4, tt:5.8e6, tt_views:3.8, fb:15e6, yt:1.4e6, yt_views:1.5,
    fb_regions:"USA 58% · Philippines 12% · China 8%",
    trend:35, trend_dir:"declining", market_value:41.8,
    sub:{social:80.4,eng:100,trend:27,spon:98,val:43.8},
    sponsors:["Under Armour","Chase","Callaway","Subway"] },
  { name:"Patrick Mahomes", short:"MAHOMES", position:"Quarterback", rank:1,
    team:"Kansas City Chiefs", nationality:"Global", age:30, sport:"American Football",
    image:"https://upload.wikimedia.org/wikipedia/commons/9/92/Patrick_Mahomes_%2851615475056%29.jpg",
    bio:"Three-time Super Bowl champion and back-to-back MVP. Widely considered the best QB in the NFL. A generational talent with growing commercial appeal.",
    brand_score:74.1, tier:"Major Star",
    ig:6.7e6, ig_eng:4.1, tt:1.5e6, tt_views:2.9, fb:1.2e6, yt:0.12e6, yt_views:0.8,
    fb_regions:"USA 91% · Canada 5% · Mexico 2%",
    trend:79, trend_dir:"stable", market_value:16.8,
    sub:{social:58.1,eng:94.4,trend:79,spon:81.6,val:32.6},
    sponsors:["Adidas","Oakley","State Farm","Subway"] },
  { name:"Victor Wembanyama", short:"WEMBY", position:"Center", rank:1,
    team:"San Antonio Spurs", nationality:"France", age:22, sport:"Basketball",
    image:"https://upload.wikimedia.org/wikipedia/commons/6/65/Victor_Wembanyama_San_Antonio_Spurs_2024.jpg",
    bio:"Nicknamed the Alien. At 22, already the most unique talent in NBA history. A once-in-a-generation player with massive long-term brand upside.",
    brand_score:73.5, tier:"Major Star",
    ig:12.3e6, ig_eng:3.6, tt:7.3e6, tt_views:1.8, fb:6.5e6, yt:0.62e6, yt_views:0.1,
    fb_regions:"USA 60% · China 15% · Philippines 10%",
    trend:77, trend_dir:"declining", market_value:11.1,
    sub:{social:69,eng:94.2,trend:69,spon:74.6,val:30},
    sponsors:["Puma","Red Bull","Porsche","TAG Heuer"] },
  { name:"Iga Świątek", short:"ŚWIĄTEK", position:"Player", rank:3,
    team:"WTA Tour", nationality:"Global", age:24, sport:"Tennis",
    image:"https://upload.wikimedia.org/wikipedia/commons/9/98/Iga_Swiatek_2023_Cropped_%2B_Retouched.jpg",
    bio:"World No. 3 and former No. 1 for 125 weeks. Four Roland Garros titles. Rising star with a perfect 100/100 trend score — tennis's fastest growing brand.",
    brand_score:73.4, tier:"Major Star",
    ig:4.3e6, ig_eng:3.9, tt:1.8e6, tt_views:4.6, fb:1.98e6, yt:0.086e6, yt_views:1.9,
    fb_regions:"Europe 40% · USA 30% · Australia 10%",
    trend:95, trend_dir:"rising", market_value:22.1,
    sub:{social:56.5,eng:89.4,trend:100,spon:59.6,val:34.9},
    sponsors:["New Balance","Crypto.com","Ford","Rolex"] },
  { name:"Christian McCaffrey", short:"McCAFFREY", position:"Running Back", rank:1,
    team:"San Francisco 49ers", nationality:"Global", age:29, sport:"American Football",
    image:"https://upload.wikimedia.org/wikipedia/commons/e/ee/Christian_McCaffrey_2019.jpg",
    bio:"The most complete running back in the NFL. Two-time All-Pro. Consistent performer with strong brand values and growing crossover appeal.",
    brand_score:73.1, tier:"Major Star",
    ig:5e6, ig_eng:4.3, tt:1.65e6, tt_views:4.8, fb:2.35e6, yt:0.65e6, yt_views:1.2,
    fb_regions:"USA 92% · Canada 5% · Germany 2%",
    trend:88, trend_dir:"stable", market_value:22.6,
    sub:{social:58.3,eng:89.6,trend:88,spon:70.4,val:35.2},
    sponsors:["Adidas","Pepsi","Coca-Cola","Red Bull"] },
  { name:"Shai Gilgeous-Alexander", short:"SGA", position:"Point Guard", rank:1,
    team:"OKC Thunder", nationality:"Global", age:27, sport:"Basketball",
    image:"https://upload.wikimedia.org/wikipedia/commons/8/8c/2023-08-09_Deutschland_gegen_Kanada_%28Basketball-L%C3%A4nderspiel%29_by_Sandro_Halank%E2%80%93109.jpg",
    bio:"Nicknamed SGA. The NBA's scoring champion and the coolest brand in basketball. Known as much for his fashion sense as his silky scoring ability.",
    brand_score:73.1, tier:"Major Star",
    ig:12.4e6, ig_eng:3.3, tt:6.1e6, tt_views:4.6, fb:3.7e6, yt:1.73e6, yt_views:1.4,
    fb_regions:"USA 60% · China 15% · Philippines 10%",
    trend:63, trend_dir:"stable", market_value:16.7,
    sub:{social:67.9,eng:99.8,trend:63,spon:69,val:32.5},
    sponsors:["New Balance","TAG Heuer","Bud Light","Richard Mille"] },
];

function SportBg({ sport }) {
  if (sport === "Soccer") return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.15}} viewBox="0 0 220 340" preserveAspectRatio="xMidYMid slice">
      {[0,40,80,120,160,200].map(x=><rect key={x} x={x} width="20" height="340" fill="rgba(255,255,255,0.07)"/>)}
      <circle cx="110" cy="170" r="52" fill="none" stroke="white" strokeWidth="1.5"/>
      <circle cx="110" cy="170" r="3" fill="white"/>
      <line x1="0" y1="170" x2="220" y2="170" stroke="white" strokeWidth="1.5"/>
      <rect x="55" y="10" width="110" height="58" fill="none" stroke="white" strokeWidth="1.5"/>
      <rect x="75" y="10" width="70" height="28" fill="none" stroke="white" strokeWidth="1.5"/>
      <rect x="55" y="272" width="110" height="58" fill="none" stroke="white" strokeWidth="1.5"/>
      <rect x="75" y="302" width="70" height="28" fill="none" stroke="white" strokeWidth="1.5"/>
      <path d="M 0 10 Q 12 10 12 22" fill="none" stroke="white" strokeWidth="1"/>
      <path d="M 220 10 Q 208 10 208 22" fill="none" stroke="white" strokeWidth="1"/>
      <path d="M 0 330 Q 12 330 12 318" fill="none" stroke="white" strokeWidth="1"/>
      <path d="M 220 330 Q 208 330 208 318" fill="none" stroke="white" strokeWidth="1"/>
    </svg>
  );
  if (sport === "Basketball") return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.14}} viewBox="0 0 220 340" preserveAspectRatio="xMidYMid slice">
      {[0,16,32,48,64,80,96,112,128,144,160,176,192,208,224].map(y=><line key={y} x1="0" y1={y} x2="220" y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>)}
      <line x1="0" y1="170" x2="220" y2="170" stroke="white" strokeWidth="1.5"/>
      <circle cx="110" cy="170" r="40" fill="none" stroke="white" strokeWidth="1.5"/>
      <path d="M 20 0 L 20 80 Q 20 175 110 175 Q 200 175 200 80 L 200 0" fill="none" stroke="white" strokeWidth="1.5"/>
      <path d="M 20 340 L 20 260 Q 20 165 110 165 Q 200 165 200 260 L 200 340" fill="none" stroke="white" strokeWidth="1.5"/>
      <rect x="70" y="0" width="80" height="80" fill="none" stroke="white" strokeWidth="1"/>
      <rect x="70" y="260" width="80" height="80" fill="none" stroke="white" strokeWidth="1"/>
      <line x1="85" y1="5" x2="135" y2="5" stroke="white" strokeWidth="2"/>
      <line x1="85" y1="335" x2="135" y2="335" stroke="white" strokeWidth="2"/>
    </svg>
  );
  if (sport === "Tennis") return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.15}} viewBox="0 0 220 340" preserveAspectRatio="xMidYMid slice">
      <rect x="18" y="18" width="184" height="304" fill="none" stroke="white" strokeWidth="1.5"/>
      <line x1="18" y1="74" x2="202" y2="74" stroke="white" strokeWidth="1"/>
      <line x1="18" y1="266" x2="202" y2="266" stroke="white" strokeWidth="1"/>
      <line x1="110" y1="74" x2="110" y2="266" stroke="white" strokeWidth="1"/>
      <line x1="18" y1="170" x2="202" y2="170" stroke="white" strokeWidth="2.5"/>
      <line x1="108" y1="165" x2="108" y2="175" stroke="white" strokeWidth="3"/>
      {[50,70,90,110,130,150,170].map(x=><line key={x} x1={x} y1="13" x2={x} y2="23" stroke="white" strokeWidth="1"/>)}
      {[50,70,90,110,130,150,170].map(x=><line key={x} x1={x} y1="317" x2={x} y2="327" stroke="white" strokeWidth="1"/>)}
    </svg>
  );
  if (sport === "American Football") return (
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.14}} viewBox="0 0 220 340" preserveAspectRatio="xMidYMid slice">
      <rect x="10" y="10" width="200" height="320" fill="none" stroke="white" strokeWidth="1.5"/>
      <rect x="10" y="10" width="200" height="36" fill="rgba(255,255,255,0.06)" stroke="white" strokeWidth="1"/>
      <rect x="10" y="294" width="200" height="36" fill="rgba(255,255,255,0.06)" stroke="white" strokeWidth="1"/>
      {[74,102,130,158,186,214,242,270].map((y,i)=>(
        <g key={y}>
          <line x1="10" y1={y} x2="210" y2={y} stroke="white" strokeWidth="0.8"/>
          {[30,50,70,90,110,130,150,170,190].map(x=><line key={x} x1={x} y1={y-4} x2={x} y2={y+4} stroke="white" strokeWidth="0.8"/>)}
        </g>
      ))}
      <line x1="110" y1="46" x2="110" y2="294" stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 4"/>
      <text x="14" y="34" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="bold">END ZONE</text>
      <text x="14" y="320" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="bold">END ZONE</text>
    </svg>
  );
  return null;
}

function MiniBar({ value, color }) {
  return (
    <div style={{flex:1, height:4, background:"rgba(255,255,255,0.12)", borderRadius:2, overflow:"hidden"}}>
      <div style={{width:`${Math.min(100,value)}%`, height:"100%", borderRadius:2, background:color}}/>
    </div>
  );
}

function Sec({ title, children, accent }) {
  return (
    <div style={{background:"rgba(255,255,255,0.05)", borderRadius:6, padding:"5px 7px", border:"0.5px solid rgba(255,255,255,0.09)"}}>
      <p style={{margin:"0 0 4px", fontSize:7, fontWeight:"900", color:accent, textTransform:"uppercase", letterSpacing:1}}>{title}</p>
      {children}
    </div>
  );
}

function CardFront({ p, cfg, onFlip }) {
  const igBar = Math.min(100, p.ig/6.5e6);
  return (
    <div style={{position:"absolute", inset:0, borderRadius:16, overflow:"hidden", backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden"}}>
      <div style={{position:"absolute", inset:0, background:`linear-gradient(145deg,${cfg.gradient[0]} 0%,${cfg.gradient[1]} 55%,${cfg.gradient[2]} 100%)`}}/>
      <SportBg sport={p.sport}/>
      <div style={{position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 40%,rgba(255,255,255,0.04) 100%)"}}/>
      <div style={{position:"absolute", inset:2, borderRadius:14, border:"1px solid rgba(255,255,255,0.2)", pointerEvents:"none"}}/>

      <div style={{position:"relative", zIndex:1, height:"100%", display:"flex", flexDirection:"column", fontFamily:"'Arial Black','Arial',sans-serif"}}>
        <div style={{textAlign:"center", paddingTop:6}}>
          <span style={{fontSize:7, fontWeight:"900", letterSpacing:2, color:"rgba(255,255,255,0.65)", textTransform:"uppercase"}}>{p.tier} · #{p.rank}</span>
        </div>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"0 11px", marginTop:2}}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
            <span style={{fontSize:34, fontWeight:"900", color:"#fff", lineHeight:1, textShadow:"0 2px 8px rgba(0,0,0,0.7)"}}>{p.brand_score}</span>
            <span style={{fontSize:9, fontWeight:"700", color:"rgba(255,255,255,0.8)", letterSpacing:0.5, marginTop:1}}>{p.position.toUpperCase().split(" ")[0]}</span>
            <span style={{fontSize:16, marginTop:4}}>{FLAG[p.nationality]||"🌍"}</span>
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:3, paddingTop:2}}>
            <div style={{width:38, height:38, borderRadius:"50%", background:"rgba(0,0,0,0.45)", border:"1.5px solid rgba(255,255,255,0.4)", display:"flex", alignItems:"center", justifyContent:"center"}}>
              <span style={{fontSize:22}}>{cfg.emoji}</span>
            </div>
            <span style={{fontSize:7, fontWeight:"900", color:"rgba(255,255,255,0.75)", letterSpacing:1, textTransform:"uppercase"}}>{p.sport === "American Football" ? "NFL" : p.sport}</span>
            <span style={{fontSize:7, color:"rgba(255,255,255,0.5)"}}>{fmt(p.ig)} IG</span>
          </div>
        </div>

        <div style={{flex:1, display:"flex", alignItems:"flex-end", justifyContent:"center", overflow:"hidden", marginTop:-4, position:"relative"}}>
          <div style={{position:"absolute", bottom:0, left:"15%", right:"15%", height:16, background:"rgba(0,0,0,0.35)", borderRadius:"50%", filter:"blur(6px)"}}/>
          <img src={p.image} alt={p.name}
            style={{height:"100%", maxHeight:142, objectFit:"cover", objectPosition:"top center", width:"100%",
              maskImage:"linear-gradient(to bottom,black 55%,transparent 100%)",
              WebkitMaskImage:"linear-gradient(to bottom,black 55%,transparent 100%)"}}
            onError={e=>{e.target.parentNode.innerHTML=`<div style="height:120px;display:flex;align-items:center;justify-content:center"><span style="font-size:44px">👤</span></div>`;}}
          />
        </div>

        <div style={{textAlign:"center", padding:"0 8px", marginBottom:1}}>
          <span style={{fontSize:17, fontWeight:"900", color:"#fff", letterSpacing:1.5, textShadow:"0 2px 10px rgba(0,0,0,0.7)", display:"block", lineHeight:1.1}}>{p.short}</span>
          <span style={{fontSize:7.5, color:"rgba(255,255,255,0.45)", letterSpacing:0.5}}>{p.team}</span>
        </div>

        <div style={{margin:"0 11px 4px", height:1, background:"rgba(255,255,255,0.18)"}}/>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0px 0", padding:"0 11px 5px"}}>
          {[
            {l:"SOC", v:p.sub.social}, {l:"ENG", v:p.sub.eng},
            {l:"SPO", v:p.sub.spon},  {l:"GRO", v:p.sub.trend},
            {l:"REA", v:p.sub.val},   {l:"VAL", v:Math.round(p.market_value/1.712)},
          ].map((s,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:4, padding:"1px 3px"}}>
              <span style={{fontSize:12, fontWeight:"900", color:"#fff", minWidth:24, textShadow:"0 1px 4px rgba(0,0,0,0.6)"}}>{Math.round(s.v)}</span>
              <span style={{fontSize:8.5, fontWeight:"700", color:"rgba(255,255,255,0.55)", letterSpacing:0.5}}>{s.l}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex", justifyContent:"center", paddingBottom:8}}>
          <button onClick={e=>{e.stopPropagation();onFlip();}} style={{background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.3)", borderRadius:20, padding:"4px 16px", cursor:"pointer", color:"#fff", fontSize:9, fontWeight:"700", letterSpacing:1, display:"flex", alignItems:"center", gap:5}}>
            🔄 VIEW STATS
          </button>
        </div>
      </div>
    </div>
  );
}

function CardBack({ p, cfg, onFlip }) {
  const platforms = [
    {name:"Instagram", emoji:"📸", followers:fmt(p.ig), eng:p.ig_eng+"%", bar:Math.min(100,p.ig/6.25e6)},
    {name:"TikTok",    emoji:"🎵", followers:fmt(p.tt), eng:p.tt_views+"M views", bar:Math.min(100,p.tt/45e4)},
    {name:"Facebook",  emoji:"📘", followers:fmt(p.fb), eng:"", bar:Math.min(100,p.fb/1.68e6)},
    {name:"YouTube",   emoji:"▶️",  followers:fmt(p.yt), eng:p.yt_views+"M views", bar:Math.min(100,p.yt/65e4)},
  ];
  return (
    <div style={{position:"absolute", inset:0, borderRadius:16, overflow:"hidden", backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg)"}}>
      <div style={{position:"absolute", inset:0, background:`linear-gradient(160deg,#080d14 0%,#0e1220 100%)`}}/>
      <div style={{position:"absolute", inset:0, background:`linear-gradient(145deg,${cfg.gradient[0]}22 0%,${cfg.gradient[1]}0e 100%)`}}/>
      <div style={{position:"absolute", inset:2, borderRadius:14, border:`1px solid ${cfg.accent}44`, pointerEvents:"none"}}/>

      <div style={{position:"relative", zIndex:1, height:"100%", boxSizing:"border-box", padding:"8px 9px", display:"flex", flexDirection:"column", gap:5, fontFamily:"'Arial',sans-serif", overflow:"hidden"}}>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0}}>
          <div>
            <p style={{margin:0, fontSize:11, fontWeight:"900", color:"#fff", letterSpacing:0.8}}>{p.short} {cfg.emoji}</p>
            <p style={{margin:0, fontSize:7, color:cfg.accent, letterSpacing:1, textTransform:"uppercase"}}>{p.tier} · Score {p.brand_score}</p>
          </div>
          <button onClick={e=>{e.stopPropagation();onFlip();}} style={{background:`${cfg.gradient[0]}55`, border:`1px solid ${cfg.accent}88`, borderRadius:8, padding:"3px 8px", cursor:"pointer", color:"#fff", fontSize:8, fontWeight:"700", display:"flex", alignItems:"center", gap:3}}>
            🔄 FLIP
          </button>
        </div>

        <Sec title="📝 About" accent={cfg.accent}>
          <p style={{margin:0, fontSize:7.5, color:"rgba(255,255,255,0.72)", lineHeight:1.45}}>{p.bio}</p>
        </Sec>

        <Sec title="📱 Social Platforms" accent={cfg.accent}>
          <div style={{display:"flex", flexDirection:"column", gap:3}}>
            {platforms.map(pl=>(
              <div key={pl.name} style={{display:"flex", alignItems:"center", gap:4}}>
                <span style={{fontSize:10}}>{pl.emoji}</span>
                <span style={{fontSize:7, color:"rgba(255,255,255,0.4)", width:48, flexShrink:0}}>{pl.name}</span>
                <MiniBar value={pl.bar} color={cfg.accent}/>
                <span style={{fontSize:7.5, fontWeight:"700", color:"#fff", width:30, textAlign:"right", flexShrink:0}}>{pl.followers}</span>
                {pl.eng && <span style={{fontSize:6.5, color:"rgba(255,255,255,0.4)", width:28, flexShrink:0, textAlign:"right"}}>{pl.eng}</span>}
              </div>
            ))}
          </div>
        </Sec>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, flexShrink:0}}>
          <Sec title="👥 Audience" accent={cfg.accent}>
            <p style={{margin:"0 0 1px", fontSize:7, color:"rgba(255,255,255,0.4)"}}>🌍 Regions</p>
            <p style={{margin:"0 0 3px", fontSize:7, color:"rgba(255,255,255,0.72)", lineHeight:1.4}}>{p.fb_regions}</p>
            <p style={{margin:"0 0 1px", fontSize:7, color:"rgba(255,255,255,0.4)"}}>📈 Trend</p>
            <p style={{margin:0, fontSize:7.5, fontWeight:"700", color:TCOL[p.trend_dir]}}>{p.trend} · {TDIR[p.trend_dir]}</p>
          </Sec>
          <Sec title="💰 Market Value" accent={cfg.accent}>
            <p style={{margin:"0 0 3px", fontSize:9, fontWeight:"900", color:"#fff"}}>${p.market_value}M</p>
            <p style={{margin:"0 0 1px", fontSize:7, color:"rgba(255,255,255,0.4)"}}>🏅 Brand Score</p>
            <p style={{margin:"0 0 3px", fontSize:10, fontWeight:"900", color:cfg.accent}}>{p.brand_score}</p>
            <p style={{margin:0, fontSize:7, color:"rgba(255,255,255,0.4)"}}>Age {p.age} · {p.nationality}</p>
          </Sec>
        </div>

        <Sec title="🤝 Sponsors" accent={cfg.accent}>
          <div style={{display:"flex", flexWrap:"wrap", gap:3}}>
            {p.sponsors.map(s=>(
              <span key={s} style={{fontSize:7.5, fontWeight:"700", padding:"2px 7px", borderRadius:4, background:`${cfg.gradient[0]}55`, border:`0.5px solid ${cfg.accent}88`, color:"#fff"}}>{s}</span>
            ))}
          </div>
        </Sec>

      </div>
    </div>
  );
}

function FifaCard({ p }) {
  const [flipped, setFlipped] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cfg = SPORT_CFG[p.sport];

  return (
    <div
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        width:220, height:340, flexShrink:0,
        perspective:"1000px",
        transition:"transform 0.3s ease, filter 0.3s ease",
        transform: hovered&&!flipped ? "translateY(-10px) scale(1.03)" : "translateY(0) scale(1)",
        filter: hovered ? `drop-shadow(0 20px 30px ${cfg.gradient[0]}cc)` : "drop-shadow(0 4px 14px rgba(0,0,0,0.55))",
      }}
    >
      <div style={{width:"100%", height:"100%", position:"relative", transformStyle:"preserve-3d", transition:"transform 0.7s cubic-bezier(0.4,0.2,0.2,1)", transform:flipped?"rotateY(180deg)":"rotateY(0deg)", borderRadius:16}}>
        <CardFront p={p} cfg={cfg} onFlip={()=>setFlipped(true)}/>
        <CardBack  p={p} cfg={cfg} onFlip={()=>setFlipped(false)}/>
      </div>
    </div>
  );
}

export default function App() {
  const [filter, setFilter] = useState("All");
  const sports = ["All","Soccer","Basketball","Tennis","American Football"];
  const visible = filter==="All" ? PLAYERS : PLAYERS.filter(p=>p.sport===filter);

  return (
    <div style={{minHeight:"100vh", background:"#060911", position:"relative", overflow:"hidden"}}>

      {/* Page background — dark stadium with radial light */}
      <div style={{position:"fixed", inset:0, zIndex:0,
        background:"radial-gradient(ellipse at 50% 0%, #1a2a4a 0%, #060911 60%)",
        pointerEvents:"none"}}/>
      {/* Subtle grid lines */}
      <div style={{position:"fixed", inset:0, zIndex:0, pointerEvents:"none",
        backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize:"40px 40px"}}/>
      {/* Top glow beam */}
      <div style={{position:"fixed", top:0, left:"30%", right:"30%", height:2, zIndex:0, background:"linear-gradient(90deg, transparent, rgba(99,179,237,0.4), transparent)", pointerEvents:"none"}}/>

      {/* ===== TITLE PAGE ===== */}
      <div style={{position:"relative", zIndex:1, textAlign:"center", padding:"40px 20px 32px"}}>

        {/* Logo mark */}
        <div style={{display:"inline-flex", alignItems:"center", gap:10, marginBottom:16}}>
          <div style={{width:48, height:48, borderRadius:12, background:"linear-gradient(135deg,#2563eb,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26}}>🏆</div>
          <div style={{textAlign:"left"}}>
            <p style={{margin:0, fontSize:22, fontWeight:"900", color:"#fff", letterSpacing:2, lineHeight:1}}>AthleteIQ</p>
            <p style={{margin:0, fontSize:10, color:"rgba(99,179,237,0.8)", letterSpacing:3, textTransform:"uppercase"}}>Marketing Intelligence</p>
          </div>
        </div>

        <h1 style={{margin:"0 0 8px", fontSize:28, fontWeight:"900", color:"#fff", letterSpacing:1, lineHeight:1.2}}>
          Top Athlete<br/>
          <span style={{background:"linear-gradient(90deg,#60a5fa,#a78bfa,#f472b6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>Brand Intelligence Cards</span>
        </h1>
        <p style={{margin:"0 0 20px", fontSize:13, color:"rgba(255,255,255,0.5)", maxWidth:420, marginLeft:"auto", marginRight:"auto", lineHeight:1.6}}>
          Real scraped data · Wikipedia · Social metrics · Brand scores<br/>
          By Dhananjaya Kumar Mittapalli &amp; Saiteja Reddy Gajula
        </p>

        {/* Stats row */}
        <div style={{display:"flex", justifyContent:"center", gap:12, flexWrap:"wrap", marginBottom:24}}>
          {[["62","Athletes"],["4","Sports"],["86.8","Top Score"],["625M","Most Followed"]].map(([v,l])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 18px", minWidth:72}}>
              <p style={{margin:0, fontSize:18, fontWeight:"900", color:"#fff"}}>{v}</p>
              <p style={{margin:0, fontSize:9, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:1}}>{l}</p>
            </div>
          ))}
        </div>

        {/* Sport filter */}
        <div style={{display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap"}}>
          {sports.map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{
              padding:"6px 14px", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:"700",
              border: filter===s ? `1.5px solid ${s==="Soccer"?"#4ade80":s==="Basketball"?"#fb923c":s==="Tennis"?"#c084fc":s==="American Football"?"#60a5fa":"#7c3aed"}` : "1px solid rgba(255,255,255,0.15)",
              background: filter===s ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
              color: filter===s ? "#fff" : "rgba(255,255,255,0.5)",
              transition:"all 0.2s",
            }}>
              {s==="Soccer"?"⚽ Soccer":s==="Basketball"?"🏀 Basketball":s==="Tennis"?"🎾 Tennis":s==="American Football"?"🏈 NFL":"🌍 All Sports"}
            </button>
          ))}
        </div>
      </div>

      {/* ===== CARDS GRID ===== */}
      <div style={{position:"relative", zIndex:1, display:"flex", flexWrap:"wrap", gap:20, justifyContent:"center", alignItems:"flex-start", padding:"0 20px 40px"}}>
        {visible.map(p=><FifaCard key={p.name} p={p}/>)}
      </div>

      {/* Footer */}
      <div style={{position:"relative", zIndex:1, textAlign:"center", padding:"0 20px 24px"}}>
        <p style={{margin:0, fontSize:10, color:"rgba(255,255,255,0.2)"}}>Data sourced from Wikipedia · Social media platforms · Google Trends · Public sponsorship records</p>
      </div>
    </div>
  );
}