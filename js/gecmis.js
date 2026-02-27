let currentTextId = null;
function showHistory(){
    hideAll();
    historyArea.style.display="block";
    loadHistory();
}
function saveText(text){
    let texts=getTexts();
    let id=Date.now();
    texts.push({id:id,content:text,date:new Date().toISOString()});
    localStorage.setItem("texts",JSON.stringify(texts));
}
function getTexts(){
    return JSON.parse(localStorage.getItem("texts")||"[]");
}

function loadHistory(){
    let texts=getTexts();
    texts.sort((a,b)=>new Date(b.date)-new Date(a.date));

    historyList.innerHTML="";

    texts.forEach(t=>{
        let div=document.createElement("div");
        div.className="historyItem";
        div.innerHTML=`
            <b>${new Date(t.date).toLocaleString()}</b><br><br>
            ${t.content.substring(0,120)}...
            <br><br>
            <button class="primary" onclick="startReading(${t.id})">Oku</button>
            <button class="secondary" onclick="editText(${t.id})">Düzenle</button>
            <button class="danger" onclick="deleteText(${t.id})">Sil</button>
        `;
        historyList.appendChild(div);
    });
}
function editText(id){
    let texts=getTexts();
    let found=texts.find(t=>t.id===id);
    if(!found) return;

    hideAll();
    inputArea.style.display="block";
    userText.value=found.content;
    currentTextId=id;
}

function deleteText(id){
    let texts=getTexts().filter(t=>t.id!==id);
    localStorage.setItem("texts",JSON.stringify(texts));
    loadHistory();
}
