/* SEXSI TOURNAMENTS bilingual UI layer. Presentation only; no app logic or data changes. */
(() => {
  "use strict";
  const dictionary = {"НАЧАЛО":"HOME","КЪМ НАЧАЛНАТА СТРАНИЦА":"GO TO HOMEPAGE","← КЪМ НАЧАЛОТО":"← BACK TO HOME","← ОБРАТНО КЪМ НАЧАЛОТО":"← BACK TO HOME","ТУРНИРИ":"TOURNAMENTS","МОИТЕ ДВУБОИ":"MY MATCHES","КЛАСАЦИЯ":"RANKING","КЛАСАЦИЯ НА ИГРАЧИТЕ":"PLAYER RANKING","ПРОФИЛ":"PROFILE","СЪОБЩЕНИЯ":"MESSAGES","АРХИВ":"ARCHIVE","ПОВЕРИТЕЛНОСТ":"PRIVACY","ЗАПИШИ СЕ":"REGISTER","ЗАПИШИ СЕ ЗА ТУРНИРА":"REGISTER FOR THE TOURNAMENT","ПОВЕЧЕ ИНФОРМАЦИЯ":"MORE INFORMATION","ВЛЕЗ":"LOG IN","ВЛЕЗ В ПРОФИЛА":"LOG IN","ВЛЕЗ В ПРОФИЛА СИ":"LOG IN TO YOUR ACCOUNT","ИЗХОД":"LOG OUT","ИЗХОД ОТ ПРОФИЛА":"LOG OUT","ИГРАЧ":"PLAYER","ПОБЕДИ":"WINS","ЗАГУБИ":"LOSSES","ТОЧКИ":"POINTS","ЗАРЕЖДАНЕ...":"LOADING...","Зареждане...":"Loading...","Зареждане":"Loading","ОБНОВИ":"REFRESH","ОБНОВИ ИНФОРМАЦИЯТА":"REFRESH INFORMATION","ПРЕДСТОЯЩИ ТУРНИРИ":"UPCOMING TOURNAMENTS","ТУРНИРНИ ФОРМАТИ":"TOURNAMENT FORMATS","ЧЕСТО ЗАДАВАНИ ВЪПРОСИ":"FREQUENTLY ASKED QUESTIONS","ОФИЦИАЛЕН ТУРНИР":"OFFICIAL TOURNAMENT","ТУРНИРНА СХЕМА":"TOURNAMENT BRACKET","УЧАСТНИЦИ":"PARTICIPANTS","ДВУБОИ В СХЕМАТА":"MATCHES IN BRACKET","ЗАВЪРШЕНИ МАЧОВЕ":"COMPLETED MATCHES","КРЪГОВЕ":"ROUNDS","АВТОМАТИЧНО ОБНОВЯВАНЕ ПРИ ОТВАРЯНЕ":"AUTO-REFRESH ON OPEN","НОВИНИ":"NEWS","ОФИЦИАЛЕН ИНФОРМАЦИОНЕН КАНАЛ":"OFFICIAL INFORMATION CHANNEL","КОМЕНТАРИ":"COMMENTS","Харесва ми":"Like","Страхотно":"Awesome","Подкрепям":"I support this","Браво":"Well done","РЕДАКТИРАЙ":"EDIT","ИЗТРИЙ":"DELETE","ПУБЛИКУВАЙ КОМЕНТАР":"POST COMMENT","Напиши коментар...":"Write a comment...","Все още няма коментари. Бъди първият!":"No comments yet. Be the first!","За да реагираш или коментираш, ":"To react or comment, ","влез в профила си":"log in to your account","МОЯТ ПРОФИЛ":"MY PROFILE","ПОТРЕБИТЕЛСКИ ПРОФИЛ":"USER PROFILE","СЪЗДАЙ АКАУНТ":"CREATE ACCOUNT","Потребителско име":"Username","Твоето ID в Standoff 2":"Your Standoff 2 ID","Имейл адрес":"Email address","Парола":"Password","ПРОМЯНА НА GAME ID":"CHANGE GAME ID","Ново Standoff 2 ID":"New Standoff 2 ID","ЗАПАЗИ ID":"SAVE ID","МОИТЕ НАГРАДИ":"MY REWARDS","МОИТЕ ТУРНИРИ":"MY TOURNAMENTS","АДМИНИСТРАТОРСКИ ПАНЕЛ":"ADMIN PANEL","ОТВОРИ АДМИН ПАНЕЛА":"OPEN ADMIN PANEL","ИМЕЙЛ":"EMAIL","ТУРНИР":"TOURNAMENT","ДАТА":"DATE","СТАТУС":"STATUS","РЕЗУЛТАТ":"RESULT","ПОБЕДИТЕЛ":"WINNER","ЗАГУБА":"LOSS","ПОБЕДА":"WIN","ОТВОРЕНО ЗА РЕГИСТРАЦИЯ":"REGISTRATION OPEN","ОЧАКВАЙТЕ СКОРО":"COMING SOON","БЕЗПЛАТЕН":"FREE","БЕЗПЛАТНО":"FREE","НАГРАДА":"PRIZE","КРАЕН СРОК":"DEADLINE","НАЧАЛО НА ТУРНИРА":"TOURNAMENT START","Един срещу един":"One versus one","Двама срещу двама":"Two versus two","Отборен мач 5 срещу 5":"5 versus 5 team match","ОФИЦИАЛЕН ПРАВИЛНИК":"OFFICIAL RULEBOOK","ИНФОРМАЦИЯ ЗА ТУРНИРА":"TOURNAMENT INFORMATION","ЗАПИСВАНЕТО Е ПРИКЛЮЧИЛО":"REGISTRATION CLOSED","РЕГИСТРАЦИЯТА Е ЗАТВОРЕНА":"REGISTRATION CLOSED","МЕСТАТА СА ЗАПЪЛНЕНИ":"SLOTS ARE FULL","ВРЕМЕННО НЕДОСТЪПНО":"TEMPORARILY UNAVAILABLE","ГОТОВ ЗА ИГРА":"READY TO PLAY","ОЧАКВА НАСРОЧВАНЕ":"AWAITING SCHEDULING","ОЧАКВА СЪПЕРНИК":"AWAITING OPPONENT","ПРЕДСТОИ":"UPCOMING","ЗАВЪРШЕН":"COMPLETED","В ПРОЦЕС":"IN PROGRESS","НЯМА ВРЪЗКА":"NO CONNECTION","Проверка на профила...":"Checking profile...","Не си влязъл в профила си":"You are not logged in","Двубоите не са достъпни":"Matches are unavailable","Все още нямаш насрочени двубои":"You have no scheduled matches yet","ТВОЯТ ПРОФИЛ":"YOUR PROFILE","ОЧАКВА СЕ СЪПЕРНИК":"AWAITING OPPONENT","НАСРОЧЕН ДВУБОЙ":"SCHEDULED MATCH","ЧАС: Все още не е уговорен":"TIME: Not scheduled yet","ОЧАКВА СЕ УГОВАРЯНЕ":"AWAITING SCHEDULING","ПОБЕДИТЕЛ:":"WINNER:","МЕНЮ":"MENU","РЕГИСТРАЦИИ":"REGISTRATIONS","ИМЕЙЛИ КЪМ ИГРАЧИ":"EMAIL PLAYERS","ВСИЧКИ ИГРАЧИ":"ALL PLAYERS","УПРАВЛЕНИЕ НА ИГРАЧИ":"PLAYER MANAGEMENT","НАГРАДИ И ИЗПЛАЩАНИЯ":"REWARDS & PAYOUTS","АНАЛИЗИ И ПОСЕЩЕНИЯ":"ANALYTICS & VISITS","ОБНОВИ ДАННИТЕ":"REFRESH DATA","ОБЩ ПРЕГЛЕД":"OVERVIEW","БЪРЗ ДОСТЪП":"QUICK ACCESS","ИЗПРАТИ ИМЕЙЛИТЕ":"SEND EMAILS","СЪОБЩЕНИЕ":"MESSAGE","ЗАГЛАВИЕ":"TITLE","ИЗБЕРИ ИГРАЧ":"SELECT PLAYER","ИЗПРАТИ":"SEND","НАЗАД":"BACK","ТЪРСЕНЕ":"SEARCH","ДЕЙСТВИЯ":"ACTIONS"};
  const translated = new WeakSet();
  const skip = new Set(["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"]);
  const addTranslation = node => {
    if (!node || node.nodeType !== Node.TEXT_NODE || translated.has(node)) return;
    const parent = node.parentElement;
    if (!parent || skip.has(parent.tagName) || parent.closest(".sexsi-en")) return;
    const raw = node.nodeValue || "";
    const trimmed = raw.trim();
    if (!trimmed || !Object.prototype.hasOwnProperty.call(dictionary, trimmed)) return;
    translated.add(node);
    const span = document.createElement("span");
    span.className = "sexsi-en";
    span.lang = "en";
    span.textContent = dictionary[trimmed];
    node.parentNode.insertBefore(span, node.nextSibling);
  };
  const translateAttributes = el => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of ["placeholder","title","aria-label"]) {
      const value = el.getAttribute(attr);
      if (value && Object.prototype.hasOwnProperty.call(dictionary, value) && !el.hasAttribute("data-en-"+attr)) {
        el.setAttribute("data-en-"+attr, dictionary[value]);
        el.setAttribute(attr, value + " / " + dictionary[value]);
      }
    }
  };
  const scan = root => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) addTranslation(root);
    else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
      if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) addTranslation(node);
      if (root.querySelectorAll) root.querySelectorAll("[placeholder],[title],[aria-label]").forEach(translateAttributes);
    }
  };
  const style = document.createElement("style");
  style.textContent = ".sexsi-en{display:inline;color:#929292;font-size:.78em;font-weight:500;letter-spacing:normal;margin-left:.42em;white-space:normal}.sexsi-en:before{content:'/ ';color:#666}.sexsi-en[lang=en]{font-family:Arial,sans-serif}";
  (document.head || document.documentElement).appendChild(style);
  scan(document.documentElement);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") addTranslation(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
