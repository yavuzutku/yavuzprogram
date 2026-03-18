
const QUESTIONS = [
  { section:`Bölüm 1: A1 — Başlangıç`, q:`Welches Wort passt nicht?`, choices:[`der Apfel`,`die Banane`,`das Auto`,`die Orange`], answer:2, explanation:`"das Auto" bir araçtır; diğerleri (Apfel, Banane, Orange) meyve ismidir.` },
  { section:`Bölüm 1: A1 — Başlangıç`, q:`Ich ___ gern ins Kino.`, choices:[`gehe`,`gehst`,`geht`,`gehen`], answer:0, explanation:`"ich" ile "gehen" fiilinin Präsens çekimi "gehe"dir.` },
  { section:`Bölüm 1: A1 — Başlangıç`, q:`Was ist richtig?`, choices:[`Ich bist Hunger.`,`Du hat Hunger.`,`Er habe Hunger.`,`Ich habe Hunger.`], answer:3, explanation:`"haben" fiilinin "ich" ile doğru çekimi "habe"dir: Ich habe Hunger.` },
  { section:`Bölüm 1: A1 — Başlangıç`, q:`Wir ___ jeden Tag um 7 Uhr auf.`, choices:[`stehe`,`stehen`,`steht`,`steh`], answer:1, explanation:`"wir" ile "aufstehen" fiilinin doğru çekimi "stehen"dir (wir stehen auf).` },
  { section:`Bölüm 1: A1 — Başlangıç`, q:`Welcher Satz ist falsch?`, choices:[`Das Kind spielt im Garten.`,`Ich mag Eis.`,`Wir trinken Wasser.`,`Er gehen nach Hause.`], answer:3, explanation:`"Er gehen" yanlıştır; doğrusu "Er geht nach Hause."dir.` },
  { section:`Bölüm 2: A2 — Temel`, q:`Ich kann heute nicht kommen, ___ ich krank bin.`, choices:[`aber`,`weil`,`und`,`deshalb`], answer:1, explanation:`"weil" (çünkü) bir neden bağlacıdır ve fiili cümle sonuna taşır.` },
  { section:`Bölüm 2: A2 — Temel`, q:`Welches Wort passt nicht zu den anderen?`, choices:[`oft`,`manchmal`,`gestern`,`schnell`], answer:3, explanation:`"schnell" (hızlı) bir nitelik zarfıdır. Diğerleri (oft, manchmal, gestern) zaman zarflarıdır.` },
  { section:`Bölüm 2: A2 — Temel`, q:`Er hat mir ___ geholfen.`, choices:[`immer`,`niemand`,`jeder`,`obwohl`], answer:0, explanation:`"Er hat mir immer geholfen" = O bana her zaman yardım etti.` },
  { section:`Bölüm 2: A2 — Temel`, q:`Wenn es regnet, ___ wir zu Hause bleiben.`, choices:[`wird`,`sollen`,`müssen`,`könnte`], answer:2, explanation:`"müssen" (zorunda olmak) bu bağlamda en doğal seçimdir.` },
  { section:`Bölüm 2: A2 — Temel`, q:`Welcher Satz ist korrekt?`, choices:[`Ich freue mich für die Ferien.`,`Ich freue mich zu die Ferien.`,`Ich freue mich über die Ferien.`,`Ich freue mich auf die Ferien.`], answer:3, explanation:`"sich freuen auf" gelecekte beklenen bir şey için kullanılır.` },
  { section:`Bölüm 3: B1 — Orta`, q:`Obwohl er müde war, ___ er die ganze Nacht gearbeitet.`, choices:[`haben`,`hatte gehabt`,`hatte`,`hat`], answer:3, explanation:`Perfekt kullanılır: "hat gearbeitet". Bağımsız cümlede Perfekt normaldir.` },
  { section:`Bölüm 3: B1 — Orta`, q:`Welcher Satz ist korrekt?`, choices:[`Ich erinnere mich an den Tag, als wir uns getroffen haben.`,`Ich erinnere mich an den Tag, wann wir uns getroffen haben.`,`Ich erinnere mich den Tag, als wir uns getroffen haben.`,`Ich erinnere mich auf den Tag, als wir uns getroffen haben.`], answer:0, explanation:`"sich erinnern an" sabit yapısı; geçmiş zamandaki ana atıfta "als" kullanılır.` },
  { section:`Bölüm 3: B1 — Orta`, q:`Er sprach so schnell, dass ich kaum ___ konnte.`, choices:[`gehört`,`zu hören`,`hören`,`gehöre`], answer:2, explanation:`Modal fiil (konnte) + saf infinitiv: "hören konnte". Modal fiillerle "zu" kullanılmaz.` },
  { section:`Bölüm 3: B1 — Orta`, q:`Wenn ich mehr Zeit ___, würde ich mehr Bücher lesen.`, choices:[`hätte`,`habe`,`haben`,`gehabt`], answer:0, explanation:`Konjunktiv II (gerçek dışı koşul): "würde lesen" ile birlikte "hätte" kullanılır.` },
  { section:`Bölüm 3: B1 — Orta`, q:`Welcher Satz ist falsch?`, choices:[`Ich interessiere mich für Geschichte.`,`Ich interessiere mich für Kunst.`,`Ich interessiere mich auf Geschichte.`,`Ich interessiere mich für Musik.`], answer:2, explanation:`"sich interessieren für" sabit bir yapıdır. "auf" burada kullanılamaz.` },
  { section:`Bölüm 4: B2 — Üst Orta`, q:`Die Nachrichten, ___ gestern ausgestrahlt wurden, waren sehr spannend.`, choices:[`welche`,`denen`,`die`,`deren`], answer:2, explanation:`"die Nachrichten" çoğul → Nominativ Relativpronomen "die"dir.` },
  { section:`Bölüm 4: B2 — Üst Orta`, q:`Welcher Satz ist korrekt?`, choices:[`Trotz des Regens gingen wir spazieren.`,`Trotz der Regen gingen wir spazieren.`,`Trotz dem Regen gingen wir spazieren.`,`Trotz Regen gingen wir spazieren.`], answer:0, explanation:`"trotz" Genitiv alır: "des Regens" (maskulin/neutrum Genitiv).` },
  { section:`Bölüm 4: B2 — Üst Orta`, q:`Er tat so, ___ er alles wüsste.`, choices:[`dass`,`obwohl`,`wie`,`als`], answer:3, explanation:`"als ob" yapısının kısaltması "als" Konjunktiv II ile kullanılır.` },
  { section:`Bölüm 4: B2 — Üst Orta`, q:`Es ist notwendig, dass jeder Schüler pünktlich ___.`, choices:[`wird`,`seien`,`sei`,`ist`], answer:2, explanation:`Resmi/yazı dilinde "es ist notwendig, dass..." yapısında Konjunktiv I kullanılır: "sei".` },
  { section:`Bölüm 4: B2 — Üst Orta`, q:`Welcher Satz ist falsch?`, choices:[`Ich bin stolz auf meine Leistung.`,`Ich bin stolz auf dich.`,`Ich bin stolz auf meine Familie.`,`Ich bin stolz für meine Leistung.`], answer:3, explanation:`"stolz sein auf" sabit bir yapıdır. "für" kullanılamaz.` },
  { section:`Bölüm 5: C1 — İleri`, q:`Sie sprach mit ihm, ___ sie eigentlich wütend war, sehr freundlich.`, choices:[`obwohl`,`während`,`weil`,`damit`], answer:0, explanation:`"obwohl" (rağmen) zıtlık ifade eder: kızgın olmasına rağmen kibarca konuştu.` },
  { section:`Bölüm 5: C1 — İleri`, q:`Welcher Satz ist korrekt?`, choices:[`Es sei denn, dass wir rechtzeitig kommen, müssen wir warten.`,`Es sei denn, wir kommen rechtzeitig, müssen wir warten.`,`Es sei denn, wir rechtzeitig kommen, müssen wir warten.`,`Es sei denn, dass wir kommen rechtzeitig, müssen wir warten.`], answer:1, explanation:`"Es sei denn, + Hauptsatz": "dass" olmadan fiil 2. pozisyonda kalır.` },
  { section:`Bölüm 5: C1 — İleri`, q:`Welcher Satz ist korrekt?`, choices:[`Je mehr man übt, je besser wird man.`,`Je mehr man übt, desto besser man wird.`,`Je mehr man übt, desto besser wird man.`,`Je mehr man übt, desto besser wird man es.`], answer:2, explanation:`"Je mehr..., desto besser..." yapısında "desto" sonrasında fiil ikinci pozisyona gelir.` },
  { section:`Bölüm 5: C1 — İleri`, q:`Nachdem er den Vertrag gelesen ___, unterschrieb er vorsichtig.`, choices:[`sein`,`hat`,`gehabt`,`hatte`], answer:3, explanation:`"nachdem" Plusquamperfekt gerektirir: "gelesen hatte".` },
  { section:`Bölüm 5: C1 — İleri`, q:`Welcher Satz ist korrekt?`, choices:[`Insofern die Ergebnisse korrekt sind, dürfen wir mit der Veröffentlichung beginnen.`,`Insofern die Ergebnisse korrekt sind, wir können mit der Veröffentlichung beginnen.`,`Insofern die Ergebnisse korrekt sind, können wir mit der Veröffentlichung beginnen.`,`Insofern als die Ergebnisse korrekt sind, können wir mit der Veröffentlichung beginnen.`], answer:2, explanation:`"insofern + Nebensatz" yapısında ana cümlede fiil 2. pozisyona gelir: "können wir".` }
];

const LEVELS = [
  { min:0, max:7,   code:"A1", name:"Başlangıç Seviyesi", emoji:"🌱", color:"#22c55e", bg:"rgba(34,197,94,0.1)", border:"rgba(34,197,94,0.25)",
    desc:`Almancayla yeni tanışıyorsun. Temel kelimeler ve basit cümleler kurabilirsin. Düzenli pratikle kısa sürede ilerleyebilirsin. <a href="/wordsadd/">Kelime ekleme aracıyla</a> günlük kelimeler öğrenerek başla, <a href="/artikel/">artikel bulucu</a> ile der/die/das farkını pekiştir.` },
  { min:8, max:12,  code:"A2", name:"Temel Seviye", emoji:"📗", color:"#86efac", bg:"rgba(134,239,172,0.08)", border:"rgba(134,239,172,0.2)",
    desc:`Günlük hayatta basit iletişimi sürdürebilirsin. Temel gramer kurallarına hakimsin. <a href="/metin/">Metin analizi aracıyla</a> kısa Almanca metinler okuyarak, <a href="/quiz/">kelime quizi</a> ile öğrendiklerini pekiştirerek A2→B1 geçişini hızlandırabilirsin.` },
  { min:13, max:17, code:"B1", name:"Orta Seviye", emoji:"📘", color:"#60c8f0", bg:"rgba(96,200,240,0.08)", border:"rgba(96,200,240,0.2)",
    desc:`Günlük hayatın büyük bölümünde Almancayı kullanabilirsin. <a href="/cumlebul/">Cümle örnekleri aracıyla</a> kelimeleri bağlamında öğrenmek, <a href="/dersler/">B1 derslerini</a> takip etmek B2'ye geçişini destekleyecek.` },
  { min:18, max:22, code:"B2", name:"Üst Orta Seviye", emoji:"📙", color:"#818cf8", bg:"rgba(129,140,248,0.08)", border:"rgba(129,140,248,0.2)",
    desc:`Karmaşık konularda Almanca anlayabilir ve ifade edebilirsin. <a href="/metin/">Gerçek Almanca metinler</a> okuyarak ve <a href="/ceviri/">çeviri aracını</a> kullanarak C1'e hazırlanabilirsin.` },
  { min:23, max:25, code:"C1", name:"İleri Seviye", emoji:"🏆", color:"#c9a84c", bg:"rgba(201,168,76,0.1)", border:"rgba(201,168,76,0.25)",
    desc:`Almancayı akıcı ve etkili kullanabiliyorsun. Tebrikler! <a href="/cumlebul/">Cümle örnekleri</a> ve <a href="/blog/">blog yazıları</a> ile nüanslı ifadeleri geliştirmeye devam edebilirsin.` }
];

let current=0, score=0, answered=false, wrongs=[];

function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function highlightBlank(t){return escHtml(t).replace(/___/g,'<em>___</em>');}

function startQuiz(){
  current=0;score=0;answered=false;wrongs=[];
  show('screen-quiz');renderQuestion();  
  sessionStorage.removeItem('svt_result'); // ← YENİ
  document.dispatchEvent(new CustomEvent('svt:start'));
  sessionStorage.removeItem('svt_result');
}
function restartQuiz(){startQuiz();}

function renderQuestion(){
  const q=QUESTIONS[current]; answered=false;
  const pct=Math.round(((current+1)/QUESTIONS.length)*100);
  document.getElementById('progress-fill').style.width=pct+'%';
  document.getElementById('q-label').textContent=`Soru ${current+1} / ${QUESTIONS.length}`;
  document.getElementById('q-section-label').textContent=q.section;
  document.getElementById('score-pill').textContent=`✓ ${score}`;

  const sw=document.getElementById('section-tag-wrap');
  const isNew=current===0||q.section!==QUESTIONS[current-1].section;
  sw.innerHTML=isNew?`<div class="section-tag">📌 ${escHtml(q.section)}</div>`:'';

  document.getElementById('reading-box-wrap').innerHTML=q.reading?`<div class="reading-box">${escHtml(q.reading)}</div>`:'';
  document.getElementById('q-num').textContent=String(current+1).padStart(2,'0');
  document.getElementById('q-text').innerHTML=highlightBlank(q.q);

  const keys=['a','b','c','d'];
  const ch=document.getElementById('choices');
  ch.innerHTML='';
  q.choices.forEach((c,i)=>{
    const btn=document.createElement('button');
    btn.className='choice';
    btn.innerHTML=`<span class="choice-key">${keys[i]}</span> ${escHtml(c)}`;
    btn.addEventListener('click',()=>selectAnswer(i));
    ch.appendChild(btn);
  });

  document.getElementById('feedback-bar').className='feedback-bar';
  document.getElementById('btn-next').classList.remove('show');
  window.scrollTo(0,0);
}

function selectAnswer(idx){
  if(answered)return; answered=true;
  const q=QUESTIONS[current];
  const btns=document.querySelectorAll('.choice');
  btns.forEach(b=>b.disabled=true);
  const ok=idx===q.answer;
  btns[idx].classList.add(ok?'correct':'wrong');
  if(!ok){btns[q.answer].classList.add('correct');wrongs.push({q,selected:idx});}
  else score++;
  document.getElementById('score-pill').textContent=`✓ ${score}`;
  const fb=document.getElementById('feedback-bar');
  const icon=document.getElementById('feedback-icon');
  const txt=document.getElementById('feedback-text');
  fb.className='feedback-bar '+(ok?'ok':'ko')+' show';
  icon.textContent=ok?'✅':'❌';
  const keys=['a','b','c','d'];
  txt.innerHTML=ok?`<strong>Doğru!</strong> ${escHtml(q.explanation)}`:`<strong>Yanlış. Doğru cevap: (${keys[q.answer]}) ${escHtml(q.choices[q.answer])}</strong> ${escHtml(q.explanation)}`;
  document.getElementById('btn-next').classList.add('show');
}

function nextQuestion(){
  current++;
  if(current>=QUESTIONS.length)showResult();
  else renderQuestion();
}

function showResult(){
    // ── YENİ: sonucu sessionStorage'a kaydet ──
    document.dispatchEvent(new CustomEvent('svt:result', { detail: { score, wrongs } }));
    sessionStorage.setItem('svt_result', JSON.stringify({
        score, wrongs,
        total: QUESTIONS.length
    }));
  show('screen-result');
  const pct=Math.round((score/QUESTIONS.length)*100);
  const lv=LEVELS.find(l=>score>=l.min&&score<=l.max)||LEVELS[0];
  document.getElementById('result-emoji').textContent=lv.emoji;
  document.getElementById('result-title').textContent=lv.name;
  document.getElementById('result-sub').textContent='';
  const badge=document.getElementById('result-badge');
  badge.textContent=lv.code;
  badge.style.cssText=`background:${lv.bg};border:1px solid ${lv.border};color:${lv.color};font-size:18px;font-family:var(--fd);font-weight:800;`;
  document.getElementById('result-score-num').textContent=score;
  document.getElementById('result-score-num').style.color=lv.color;
  const circle=document.getElementById('score-ring-circle');
  const circ=2*Math.PI*56;
  circle.style.stroke=lv.color;
  setTimeout(()=>{circle.style.strokeDashoffset=circ*(1-pct/100);},100);
  document.getElementById('res-correct').textContent=score;
  document.getElementById('res-wrong').textContent=QUESTIONS.length-score;
  document.getElementById('res-pct').textContent=pct+'%';
  const dc=document.getElementById('level-desc-card');
  dc.style.background=lv.bg; dc.style.borderColor=lv.border;
  document.getElementById('level-desc-title').style.color=lv.color;
  document.getElementById('level-desc-title').textContent=`${lv.code} — ${lv.name}`;
  document.getElementById('level-desc-text').innerHTML=lv.desc;
  const ws=document.getElementById('wrongs-section');
  const wl=document.getElementById('wrongs-list');
  if(wrongs.length>0){
    ws.style.display='block';
    const keys=['a','b','c','d'];
    wl.innerHTML=wrongs.map(({q,selected})=>`
      <div class="wrong-item">
        <div class="wrong-q">${escHtml(q.q)}</div>
        <div class="wrong-answers">
          <span class="wrong-your">✗ Senin: (${keys[selected]}) ${escHtml(q.choices[selected])}</span>
          <span class="wrong-correct">✓ Doğru: (${keys[q.answer]}) ${escHtml(q.choices[q.answer])}</span>
        </div>
      </div>`).join('');
  } else ws.style.display='none';
}