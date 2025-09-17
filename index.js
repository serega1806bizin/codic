  (function(){
    /* --- iOS-safe флаги и мини-утилиты --- */
    var SAFE_IOS = /iP(hone|ad|od)/.test(navigator.userAgent);

    var MS = 86400000;
    var mNames = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
    function parseISO(s){ var p=s.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
    function addDays(d,n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); }
    function diffDays(a,b){ return Math.round((b-a)/MS); }
    function monthStart(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
    function monthEnd(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
    function mondayOnOrBefore(d){ var r=new Date(d), k=r.getDay(), s=k===0?6:k-1; return addDays(r, -s); }
    function isWeekend(d){ var g=d.getDay(); return g===0 || g===6; }
    function fmtDM(d){ return ("0"+d.getDate()).slice(-2)+" "+mNames[d.getMonth()]; }
    function fmtFull(d){ return ("0"+d.getDate()).slice(-2)+"."+("0"+(d.getMonth()+1)).slice(-2)+"."+d.getFullYear(); }
    function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

    /* --- состояние и элементы --- */
    var scroller = document.getElementById("scroller");
    var hideWeekends = false;
    var zoomPresets = { day: 42, week: 27, month: 9 };
    var state = { pxPerDay: 27, headerH: 58, rowH: 36, barH: 18, leftPad: 0 };

    var MIN = parseISO(window.PRE.minISO);
    var MAX = parseISO(window.PRE.maxISO);
    var TASKS = window.PRE.tasks; // {id,title,startDay,endDay}
    var totalDays = Math.max(1, diffDays(MIN, MAX)+1);

    function inferZoom(){ return state.pxPerDay >= 28 ? "day" : (state.pxPerDay >= 10 ? "week" : "month"); }

    /* --- главный рендер SVG --- */
    function render(){
      var zoomNow = inferZoom();
      var width = state.leftPad + totalDays * state.pxPerDay + 40;
      var height = state.headerH + TASKS.length * state.rowH + 40;

      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
      svg.setAttribute("xmlns", NS);
      svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      svg.style.display = "block";

      // defs: градиент всегда, тень — не на iOS
      var defs = document.createElementNS(NS, "defs");
      var grad = document.createElementNS(NS, "linearGradient");
      grad.id = "barGrad";
      grad.setAttribute("x1","0%"); grad.setAttribute("y1","0%"); grad.setAttribute("x2","100%"); grad.setAttribute("y2","0%");
      var s1 = document.createElementNS(NS,"stop"); s1.setAttribute("offset","0%"); s1.setAttribute("stop-color","#FFB347");
      var s2 = document.createElementNS(NS,"stop"); s2.setAttribute("offset","100%"); s2.setAttribute("stop-color","#FF8C00");
      grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);

      if (!SAFE_IOS) {
        var flt = document.createElementNS(NS, "filter");
        flt.id = "barShadow"; flt.setAttribute("x","-20%"); flt.setAttribute("y","-20%"); flt.setAttribute("width","140%"); flt.setAttribute("height","140%");
        var fe = document.createElementNS(NS, "feDropShadow");
        fe.setAttribute("dx","0"); fe.setAttribute("dy","2"); fe.setAttribute("stdDeviation","2"); fe.setAttribute("flood-color","#000"); fe.setAttribute("flood-opacity","0.35");
        flt.appendChild(fe); defs.appendChild(flt);
      }
      svg.appendChild(defs);

      // фон
      var bg = document.createElementNS(NS,"rect");
      bg.setAttribute("x",0); bg.setAttribute("y",0); bg.setAttribute("width",width); bg.setAttribute("height",height); bg.setAttribute("fill","#0f1733");
      svg.appendChild(bg);

      // сетка + выходные
      var gridG = document.createElementNS(NS,"g");
      for (var i=0;i<=totalDays;i++){
        var d = addDays(MIN, i);
        if (!hideWeekends && isWeekend(d)){
          var r = document.createElementNS(NS,"rect");
          r.setAttribute("class","weekend-rect");
          r.setAttribute("x", state.leftPad + i*state.pxPerDay);
          r.setAttribute("y", state.headerH);
          r.setAttribute("width", state.pxPerDay);
          r.setAttribute("height", TASKS.length * state.rowH);
          gridG.appendChild(r);
        }
        var drawThin = state.pxPerDay >= 14 || d.getDate()===1 || i===0 || i===totalDays;
        if (drawThin){
          var l = document.createElementNS(NS,"line");
          l.setAttribute("class","grid");
          l.setAttribute("x1", state.leftPad + i*state.pxPerDay);
          l.setAttribute("y1", state.headerH - 24);
          l.setAttribute("x2", state.leftPad + i*state.pxPerDay);
          l.setAttribute("y2", height - 20);
          gridG.appendChild(l);
        }
      }
      for (var rI=0;rI<=TASKS.length;rI++){
        var y = state.headerH + rI * state.rowH;
        var hl = document.createElementNS(NS,"line");
        hl.setAttribute("class","grid");
        hl.setAttribute("x1",0); hl.setAttribute("y1",y); hl.setAttribute("x2",width); hl.setAttribute("y2",y);
        gridG.appendChild(hl);
      }
      svg.appendChild(gridG);

      // недельные разделители (кроме zoom=day)
      if (zoomNow !== "day") {
        var weekG = document.createElementNS(NS,"g");
        var ws = mondayOnOrBefore(MIN);
        while (ws <= MAX){
          var x = state.leftPad + diffDays(MIN, ws)*state.pxPerDay;
          var wl = document.createElementNS(NS,"line");
          wl.setAttribute("class","week-split");
          wl.setAttribute("x1",x); wl.setAttribute("y1",state.headerH-24); wl.setAttribute("x2",x); wl.setAttribute("y2",height-20);
          weekG.appendChild(wl);
          ws = addDays(ws, 7);
        }
        svg.appendChild(weekG);
      }

      // верх: месяцы
      var topG = document.createElementNS(NS,"g");
      var curTop = new Date(MIN.getFullYear(), MIN.getMonth(), 1);
      while (curTop <= MAX){
        var ms = monthStart(curTop), me = monthEnd(curTop);
        var x1m = state.leftPad + Math.max(0, diffDays(MIN, ms))*state.pxPerDay;
        var x2m = state.leftPad + Math.min(totalDays, diffDays(MIN, addDays(me,1)))*state.pxPerDay;
        var label = document.createElementNS(NS,"text");
        label.setAttribute("class","month");
        label.setAttribute("x", (x1m+x2m)/2);
        label.setAttribute("y", 20);
        label.setAttribute("text-anchor","middle");
        label.textContent = (["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"][curTop.getMonth()]+" "+curTop.getFullYear()).toUpperCase();
        topG.appendChild(label);
        curTop = addDays(me, 1);
      }
      svg.appendChild(topG);

      // низ: ось по зуму
      var botG = document.createElementNS(NS,"g");
      if (zoomNow === "day"){
        for (var dI=0; dI<totalDays; dI++){
          var d2 = addDays(MIN, dI);
          var td = document.createElementNS(NS,"text");
          td.setAttribute("class","axis-label");
          td.setAttribute("x", state.leftPad + (dI+0.5)*state.pxPerDay);
          td.setAttribute("y", 44);
          td.setAttribute("text-anchor","middle");
          td.textContent = ("0"+d2.getDate()).slice(-2);
          botG.appendChild(td);
        }
      } else if (zoomNow === "week"){
        var w0 = mondayOnOrBefore(MIN);
        while (w0 <= MAX){
          var wNext = addDays(w0, 7);
          var wLabel = addDays(w0, 6);
          var x1w = state.leftPad + Math.max(0, diffDays(MIN, w0))*state.pxPerDay;
          var x2w = state.leftPad + Math.min(totalDays, diffDays(MIN, wNext))*state.pxPerDay;
          var tw = document.createElementNS(NS,"text");
          tw.setAttribute("class","axis-label");
          tw.setAttribute("x", (x1w+x2w)/2);
          tw.setAttribute("y", 44);
          tw.setAttribute("text-anchor","middle");
          tw.textContent = ("0"+w0.getDate()).slice(-2)+" "+mNames[w0.getMonth()]+" — "+("0"+wLabel.getDate()).slice(-2)+" "+mNames[wLabel.getMonth()];
          botG.appendChild(tw);
          w0 = addDays(w0, 7);
        }
      } else {
        var cur = new Date(MIN.getFullYear(), MIN.getMonth(), 1);
        while (cur <= MAX){
          var ms2 = monthStart(cur), me2 = monthEnd(cur);
          var left = state.leftPad + Math.max(0, diffDays(MIN, ms2))*state.pxPerDay;
          var right= state.leftPad + Math.min(totalDays, diffDays(MIN, addDays(me2,1)))*state.pxPerDay;
          var tm = document.createElementNS(NS,"text");
          tm.setAttribute("class","axis-label");
          tm.setAttribute("x",(left+right)/2);
          tm.setAttribute("y",44);
          tm.setAttribute("text-anchor","middle");
          tm.textContent = ("0"+ms2.getDate()).slice(-2)+" "+mNames[ms2.getMonth()]+" — "+("0"+me2.getDate()).slice(-2)+" "+mNames[me2.getMonth()];
          botG.appendChild(tm);
          cur = addDays(me2, 1);
        }
      }
      svg.appendChild(botG);

      // сегодня
      var t0 = new Date(); t0 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
      if (t0 >= MIN && t0 <= MAX){
        var xt = state.leftPad + diffDays(MIN, t0)*state.pxPerDay + state.pxPerDay/2;
        var tl = document.createElementNS(NS,"line");
        tl.setAttribute("class","today-line");
        tl.setAttribute("x1",xt); tl.setAttribute("y1",state.headerH-24);
        tl.setAttribute("x2",xt); tl.setAttribute("y2",height-20);
        svg.appendChild(tl);
      }

      // бары
      var barsG = document.createElementNS(NS,"g");
      for (var iT=0;iT<TASKS.length;iT++){
        var t = TASKS[iT];
        var x = state.leftPad + t.startDay * state.pxPerDay;
        var w = Math.max(2, (t.endDay - t.startDay + 1) * state.pxPerDay);
        var y = state.headerH + iT * state.rowH + (state.rowH - state.barH)/2;

        var border = document.createElementNS(NS,"rect");
        border.setAttribute("x",x); border.setAttribute("y",y);
        border.setAttribute("width",w); border.setAttribute("height",state.barH);
        border.setAttribute("rx","6"); border.setAttribute("ry","6");
        border.setAttribute("fill","none"); border.setAttribute("stroke","rgba(255,255,255,0.18)");
        barsG.appendChild(border);

        var bar = document.createElementNS(NS,"rect");
        bar.setAttribute("x",x); bar.setAttribute("y",y);
        bar.setAttribute("width",w); bar.setAttribute("height",state.barH);
        bar.setAttribute("rx","6"); bar.setAttribute("ry","6");
        bar.setAttribute("fill","url(#barGrad)");
        if (!SAFE_IOS) bar.setAttribute("filter","url(#barShadow)");
        var title = document.createElementNS(NS,"title");
        var sD = addDays(MIN, t.startDay), eD = addDays(MIN, t.endDay);
        title.textContent = t.title + " • " + fmtFull(sD) + "—" + fmtFull(eD);
        bar.appendChild(title);
        barsG.appendChild(bar);

        // подпись: на iOS обрезаем по длине, на остальных — через clipPath
        var label = document.createElementNS(NS,"text");
        label.setAttribute("class","bar-text");
        label.setAttribute("x", x+6);
        label.setAttribute("y", y + state.barH/2 + 1);
        label.setAttribute("text-anchor","start");
        label.setAttribute("dy",".35em"); // вместо dominant-baseline для iOS
        label.textContent = t.title;

        if (SAFE_IOS) {
          barsG.appendChild(label);
          var maxW = w - 10;
          if (maxW <= 0) { label.textContent = "…"; }
          else {
            while (label.getComputedTextLength() > maxW && label.textContent.length > 1) {
              label.textContent = label.textContent.slice(0, -1);
            }
            if (label.getComputedTextLength() > maxW) label.textContent = "…";
            else if (label.textContent !== t.title) label.textContent = label.textContent.slice(0, -1) + "…";
          }
        } else {
          var clip = document.createElementNS(NS,"clipPath");
          var clipId = "clip-"+iT;
          clip.setAttribute("id", clipId);
          clip.setAttribute("clipPathUnits","userSpaceOnUse");
          var cr = document.createElementNS(NS,"rect");
          cr.setAttribute("x", x+5); cr.setAttribute("y", y-1);
          cr.setAttribute("width", Math.max(0, w-10)); cr.setAttribute("height", state.barH+4);
          clip.appendChild(cr); defs.appendChild(clip);
          label.setAttribute("clip-path", "url(#"+clipId+")");
          barsG.appendChild(label);
        }
      }
      svg.appendChild(barsG);

      // вставим свежий SVG
      scroller.innerHTML = "";
      scroller.appendChild(svg);
    }

    /* --- Взаимодействия: drag-pan, Ctrl+wheel, кнопки, fit, выходные --- */

    // Drag-pan
    (function(){
      var down=false, sx=0, sy=0, sl=0, st=0;
      scroller.addEventListener("mousedown", function(e){
        if (e.button!==0) return;
        down=true; sx=e.clientX; sy=e.clientY; sl=scroller.scrollLeft; st=scroller.scrollTop;
        scroller.style.cursor="grabbing"; e.preventDefault();
      });
      window.addEventListener("mousemove", function(e){
        if (!down) return;
        scroller.scrollLeft = sl - (e.clientX - sx);
        scroller.scrollTop  = st - (e.clientY - sy);
      });
      window.addEventListener("mouseup", function(){ down=false; scroller.style.cursor=""; });
    })();

    // Ctrl+wheel zoom (на iOS естественно не работает, но верстка остаётся)
    scroller.addEventListener("wheel", function(e){
      if (!e.ctrlKey) return;
      e.preventDefault();
      var prev = state.pxPerDay;
      var rect = scroller.getBoundingClientRect();
      var cursorX = e.clientX - rect.left + scroller.scrollLeft;
      var dateAtCursor = addDays(MIN, Math.max(0, (cursorX - state.leftPad)/state.pxPerDay));
      var delta = e.deltaY > 0 ? 1 : -1;
      var next = clamp(prev * (delta>0 ? 0.9 : 1.1), 3, 64);
      state.pxPerDay = next;
      render();
      var newCursorX = state.leftPad + diffDays(MIN, dateAtCursor) * state.pxPerDay;
      scroller.scrollLeft = Math.max(0, newCursorX - (e.clientX - rect.left));
    }, { passive:false });

    // Кнопки пресетов
    var btns = document.querySelectorAll(".btn[data-zoom]");
    for (var i=0;i<btns.length;i++){
      btns[i].addEventListener("click", function(){
        var preset = this.getAttribute("data-zoom");
        state.pxPerDay = zoomPresets[preset] || state.pxPerDay;
        render();
      });
    }

    // Fit по ширине видимой области
    document.getElementById("fit").addEventListener("click", function(){
      var viewW = scroller.clientWidth - state.leftPad - 40;
      state.pxPerDay = clamp(viewW / Math.max(1, diffDays(MIN, MAX)+1), 3, 64);
      render();
    });

    // Скрыть выходные
    document.getElementById("hide-weekends").addEventListener("change", function(e){
      hideWeekends = e.target.checked;
      render();
    });

    // первый рендер
    render();
  })();
