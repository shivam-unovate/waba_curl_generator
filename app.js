/* ============================================================
   Twixor cURL Builder — pure client-side, no data leaves the page
   ============================================================ */

(function(){

  let mode = 'bulk-one'; // bulk-one | bulk-many | single

  // ---------- Template type definitions ----------
  // Each template type knows how to render its own mini-form and
  // how to turn its current values into the JSON shape Twixor expects.
  const TPL_TYPES = ['text','image','pdf','video','buttons','header_buttons','carousel','auth'];
  const TPL_LABELS = {
    text:'Text', image:'Image + buttons', pdf:'PDF + buttons', video:'Video',
    buttons:'Text + variables + buttons', header_buttons:'Header params + buttons',
    carousel:'Carousel cards', auth:'Auth (copy code)'
  };

  // ---------- Small DOM helpers ----------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };

  function uid(){ return Math.random().toString(36).slice(2,9); }

  // ============================================================
  // PLAIN-TEXT MESSAGE BUILDER (for Bulk One-to-Many "message" field
  // which can be either {"text": "..."} OR {"template": {...}})
  // ============================================================
  function renderOneToManyMessageBuilder(){
    const wrap = $('oneMsgBuilder');
    wrap.innerHTML = '';

    const chipRow = el('div','tpl-type-row');
    const plainChip = el('button','tpl-chip active','Plain text');
    plainChip.type='button';
    const tplChip = el('button','tpl-chip','Use a template');
    tplChip.type='button';
    chipRow.appendChild(plainChip);
    chipRow.appendChild(tplChip);
    wrap.appendChild(chipRow);

    const body = el('div');
    wrap.appendChild(body);

    let useTemplate = false;
    let tplState = makeTemplateState('text');

    function renderPlain(){
      body.innerHTML = '';
      const f = el('div','field full');
      f.innerHTML = `<label>message.text</label>`;
      const ta = el('textarea');
      ta.id = 'oneTextValue';
      ta.rows = 3;
      ta.placeholder = 'common message to all users';
      ta.value = wrap.dataset.text || '';
      ta.addEventListener('input', ()=>{ wrap.dataset.text = ta.value; renderCurl(); });
      f.appendChild(ta);
      body.appendChild(f);
    }

    function renderTpl(){
      body.innerHTML = '';
      const holder = el('div');
      holder.id = 'oneTplFieldsHolder';
      const chooser = buildTemplateTypeChooser(tplState, ()=>{ renderCurl(); }, ()=>{ renderTemplateFields(holder, tplState, renderCurl); });
      body.appendChild(chooser);
      body.appendChild(holder);
      renderTemplateFields(holder, tplState, renderCurl);
    }

    plainChip.addEventListener('click', ()=>{
      useTemplate = false;
      plainChip.classList.add('active');
      tplChip.classList.remove('active');
      wrap.dataset.useTemplate = 'false';
      renderPlain();
      renderCurl();
    });
    tplChip.addEventListener('click', ()=>{
      useTemplate = true;
      tplChip.classList.add('active');
      plainChip.classList.remove('active');
      wrap.dataset.useTemplate = 'true';
      renderTpl();
      renderCurl();
    });

    wrap._getState = () => ({ useTemplate, tplState });
    // Lets preset-loading code force a specific template type, then fully
    // redraw the chooser + fields so the UI reflects the new state.
    wrap._useTemplateWithType = (type)=>{
      useTemplate = true;
      tplState.type = type;
      tplChip.classList.add('active');
      plainChip.classList.remove('active');
      wrap.dataset.useTemplate = 'true';
      renderTpl();
    };
    wrap.dataset.useTemplate = 'false';
    renderPlain();
  }

  // ============================================================
  // TEMPLATE STATE + FIELD BUILDERS
  // Shared between Bulk One-to-Many (template mode), Bulk Many-to-Many
  // (per recipient), and Single Send.
  // ============================================================
  function makeTemplateState(type){
    return {
      type: type || 'text',
      templateId: '',
      templateUId: '',
      mediaUrl: '', mediaType: 'IMAGE', mediaCaption: '', mediaFileName: '', mediaMime: '',
      parameterValues: [], // [{idx, value}]
      headerParameterValues: [],
      buttons: [], // [{text, type, url, payload, index}]
      cards: [] // for carousel: [{mediaUrl, mediaType, parameterValues:[], buttons:[]}]
    };
  }

  function buildTemplateTypeChooser(state, onChange, onTypeChange){
    const row = el('div','tpl-type-row');
    TPL_TYPES.forEach(t=>{
      const chip = el('button','tpl-chip'+(state.type===t?' active':''), TPL_LABELS[t]);
      chip.type = 'button';
      chip.addEventListener('click', ()=>{
        if(state.type === t) return; // already selected, nothing to do
        state.type = t;
        row.querySelectorAll('.tpl-chip').forEach(c=>c.classList.remove('active'));
        chip.classList.add('active');
        if(onTypeChange) onTypeChange();
        onChange();
      });
      row.appendChild(chip);
    });
    const resetBtn = el('button','tpl-chip tpl-chip-reset','↺ reset template');
    resetBtn.type = 'button';
    resetBtn.title = 'Clear templateId, parameterValues, media, and buttons for this template';
    resetBtn.addEventListener('click', ()=>{
      const keepType = state.type;
      Object.assign(state, makeTemplateState(keepType));
      if(onTypeChange) onTypeChange();
      onChange();
    });
    row.appendChild(resetBtn);
    return row;
  }

  function paramRowsEditor(container, list, label, placeholderKey, placeholderVal, onChange){
    const wrap = el('div');
    const title = el('div','hint', label);
    title.style.marginBottom = '6px';
    wrap.appendChild(title);

    function redraw(){
      wrap.querySelectorAll('.kv-row').forEach(r=>r.remove());
      list.forEach((item, i)=>{
        const row = el('div','kv-row');
        const idxInput = el('input'); idxInput.type='text'; idxInput.placeholder=placeholderKey; idxInput.value = item.idx;
        idxInput.style.maxWidth='70px';
        idxInput.addEventListener('input', ()=>{ item.idx = idxInput.value; onChange(); });
        const valInput = el('input'); valInput.type='text'; valInput.placeholder=placeholderVal; valInput.value = item.value;
        valInput.addEventListener('input', ()=>{ item.value = valInput.value; onChange(); });
        const rm = el('button','btn-remove','✕'); rm.type='button';
        rm.addEventListener('click', ()=>{ list.splice(i,1); redraw(); onChange(); });
        row.appendChild(idxInput); row.appendChild(valInput); row.appendChild(rm);
        wrap.appendChild(row);
      });
      const addBtn = el('button','btn btn-add btn-small','+ add value');
      addBtn.type='button';
      addBtn.addEventListener('click', ()=>{ list.push({idx:String(list.length), value:''}); redraw(); onChange(); });
      wrap.appendChild(addBtn);
    }
    redraw();
    return wrap;
  }

  function buttonsEditor(list, onChange){
    const wrap = el('div');
    const title = el('div','hint','Buttons'); title.style.marginBottom='6px';
    wrap.appendChild(title);

    function redraw(){
      wrap.querySelectorAll('.card').forEach(c=>c.remove());
      list.forEach((btn, i)=>{
        const card = el('div','card');
        card.style.padding = '12px';
        const head = el('div','card-head');
        head.appendChild(el('span','card-label', 'button '+i));
        const rm = el('button','btn-remove','remove'); rm.type='button';
        rm.addEventListener('click', ()=>{ list.splice(i,1); redraw(); onChange(); });
        head.appendChild(rm);
        card.appendChild(head);

        const grid = el('div','field-grid');

        const typeField = el('div','field');
        typeField.innerHTML = '<label>type</label>';
        const typeSel = el('select');
        ['QUICK_REPLY','URL'].forEach(v=>{
          const o = el('option'); o.value=v; o.textContent=v; if(btn.type===v) o.selected=true;
          typeSel.appendChild(o);
        });
        typeSel.addEventListener('change', ()=>{ btn.type = typeSel.value; onChange(); });
        typeField.appendChild(typeSel);
        grid.appendChild(typeField);

        const textField = el('div','field');
        textField.innerHTML = '<label>text</label>';
        const textInp = el('input'); textInp.type='text'; textInp.value = btn.text||''; textInp.placeholder='YES';
        textInp.addEventListener('input', ()=>{ btn.text = textInp.value; onChange(); });
        textField.appendChild(textInp);
        grid.appendChild(textField);

        const idxField = el('div','field');
        idxField.innerHTML = '<label>index</label>';
        const idxInp = el('input'); idxInp.type='text'; idxInp.value = (btn.index!==undefined? btn.index : i); idxInp.placeholder='0';
        idxInp.addEventListener('input', ()=>{ btn.index = idxInp.value; onChange(); });
        idxField.appendChild(idxInp);
        grid.appendChild(idxField);

        const payloadField = el('div','field full');
        payloadField.innerHTML = '<label>payload <span class="opt">quick-reply value, or URL link for a URL button</span></label>';
        const payloadInp = el('input'); payloadInp.type='text'; payloadInp.value = btn.payload||''; payloadInp.placeholder='yessss';
        payloadInp.addEventListener('input', ()=>{ btn.payload = payloadInp.value; onChange(); });
        payloadField.appendChild(payloadInp);
        grid.appendChild(payloadField);

        if(btn.type === 'URL'){
          const urlField = el('div','field full');
          urlField.innerHTML = '<label>url</label>';
          const urlInp = el('input'); urlInp.type='text'; urlInp.value = btn.url||''; urlInp.placeholder='https://www.google.com/';
          urlInp.addEventListener('input', ()=>{ btn.url = urlInp.value; onChange(); });
          urlField.appendChild(urlInp);
          grid.appendChild(urlField);
        }

        card.appendChild(grid);
        wrap.appendChild(card);
      });
      const addBtn = el('button','btn btn-add btn-small','+ add button');
      addBtn.type='button';
      addBtn.addEventListener('click', ()=>{
        list.push({type:'QUICK_REPLY', text:'', payload:'', index:list.length});
        redraw(); onChange();
      });
      wrap.appendChild(addBtn);
    }
    redraw();
    return wrap;
  }

  function mediaEditor(state, onChange, kind){
    const wrap = el('div','field-grid');
    const urlF = el('div','field full');
    urlF.innerHTML = '<label>media.url</label>';
    const urlInp = el('input'); urlInp.type='text'; urlInp.value = state.mediaUrl||''; urlInp.placeholder='https://...';
    urlInp.addEventListener('input', ()=>{ state.mediaUrl = urlInp.value; onChange(); });
    urlF.appendChild(urlInp);
    wrap.appendChild(urlF);

    const fnF = el('div','field');
    fnF.innerHTML = '<label>media.fileName</label>';
    const fnInp = el('input'); fnInp.type='text'; fnInp.value = state.mediaFileName||'';
    fnInp.addEventListener('input', ()=>{ state.mediaFileName = fnInp.value; onChange(); });
    fnF.appendChild(fnInp);
    wrap.appendChild(fnF);

    if(kind === 'image'){
      const capF = el('div','field');
      capF.innerHTML = '<label>media.caption <span class="opt">optional</span></label>';
      const capInp = el('input'); capInp.type='text'; capInp.value = state.mediaCaption||'';
      capInp.addEventListener('input', ()=>{ state.mediaCaption = capInp.value; onChange(); });
      capF.appendChild(capInp);
      wrap.appendChild(capF);
    }
    return wrap;
  }

  function renderTemplateFields(holder, state, onChange){
    holder.innerHTML = '';

    const carryHint = el('div','hint');
    carryHint.style.marginBottom = '10px';
    carryHint.innerHTML = 'templateId, parameterValues, media, and buttons carry over when you switch formats above — only fields that don\'t apply to this format are hidden, nothing is deleted.';
    holder.appendChild(carryHint);

    const idF = el('div','field-grid');
    const tplIdF = el('div','field');
    tplIdF.innerHTML = '<label>templateId</label>';
    const tplIdInp = el('input'); tplIdInp.type='text'; tplIdInp.value = state.templateId; tplIdInp.placeholder='test_text534453';
    tplIdInp.addEventListener('input', ()=>{ state.templateId = tplIdInp.value; onChange(); });
    tplIdF.appendChild(tplIdInp);
    idF.appendChild(tplIdF);

    if(['image','pdf','buttons','carousel'].includes(state.type)){
      const tplUidF = el('div','field');
      tplUidF.innerHTML = '<label>templateUId <span class="opt">optional</span></label>';
      const tplUidInp = el('input'); tplUidInp.type='text'; tplUidInp.value = state.templateUId;
      tplUidInp.addEventListener('input', ()=>{ state.templateUId = tplUidInp.value; onChange(); });
      tplUidF.appendChild(tplUidInp);
      idF.appendChild(tplUidF);
    }
    holder.appendChild(idF);

    switch(state.type){
      case 'text': {
        // text template: only templateId, nothing else required
        break;
      }
      case 'image': {
        holder.appendChild(mediaEditor(state, onChange, 'image'));
        const mtF = el('div','field'); mtF.style.marginTop='8px';
        mtF.innerHTML = '<label>media.type</label>';
        const sel = el('select'); ['IMAGE'].forEach(v=>{const o=el('option');o.value=v;o.textContent=v;o.selected=true;sel.appendChild(o);});
        mtF.appendChild(sel); holder.appendChild(mtF);
        state.mediaType = 'IMAGE';
        holder.appendChild(buttonsEditor(state.buttons, onChange));
        break;
      }
      case 'pdf': {
        holder.appendChild(mediaEditor(state, onChange, 'pdf'));
        state.mediaType = 'DOC';
        holder.appendChild(buttonsEditor(state.buttons, onChange));
        break;
      }
      case 'video': {
        holder.appendChild(mediaEditor(state, onChange, 'video'));
        state.mediaType = 'VIDEO';
        holder.appendChild(paramRowsEditor(holder, state.parameterValues, 'parameterValues', 'index', 'value', onChange));
        break;
      }
      case 'buttons': {
        holder.appendChild(paramRowsEditor(holder, state.parameterValues, 'parameterValues', 'index', 'value', onChange));
        holder.appendChild(buttonsEditor(state.buttons, onChange));
        break;
      }
      case 'header_buttons': {
        holder.appendChild(paramRowsEditor(holder, state.parameterValues, 'parameterValues (body)', 'index', 'value', onChange));
        holder.appendChild(paramRowsEditor(holder, state.headerParameterValues, 'headerParameterValues', 'index', 'value', onChange));
        holder.appendChild(buttonsEditor(state.buttons, onChange));
        break;
      }
      case 'carousel': {
        holder.appendChild(paramRowsEditor(holder, state.parameterValues, 'parameterValues (message bubble text)', 'index', 'value', onChange));
        const cardsWrap = el('div');
        const cardsTitle = el('div','hint','Cards'); cardsTitle.style.margin='10px 0 6px';
        cardsWrap.appendChild(cardsTitle);

        function redrawCards(){
          cardsWrap.querySelectorAll('.card.carousel-card').forEach(c=>c.remove());
          state.cards.forEach((card, i)=>{
            const c = el('div','card carousel-card');
            const head = el('div','card-head');
            head.appendChild(el('span','card-label','card '+i));
            const rm = el('button','btn-remove','remove'); rm.type='button';
            rm.addEventListener('click', ()=>{ state.cards.splice(i,1); redrawCards(); onChange(); });
            head.appendChild(rm);
            c.appendChild(head);

            const grid = el('div','field-grid');
            const urlF = el('div','field full'); urlF.innerHTML='<label>media.url</label>';
            const urlInp = el('input'); urlInp.type='text'; urlInp.value=card.mediaUrl||'';
            urlInp.addEventListener('input', ()=>{ card.mediaUrl = urlInp.value; onChange(); });
            urlF.appendChild(urlInp); grid.appendChild(urlF);

            const typeF = el('div','field'); typeF.innerHTML='<label>media.type</label>';
            const typeSel = el('select');
            ['IMAGE','VIDEO'].forEach(v=>{const o=el('option');o.value=v;o.textContent=v;if(card.mediaType===v)o.selected=true;typeSel.appendChild(o);});
            typeSel.addEventListener('change', ()=>{ card.mediaType = typeSel.value; onChange(); });
            typeF.appendChild(typeSel); grid.appendChild(typeF);
            c.appendChild(grid);

            c.appendChild(paramRowsEditor(c, card.parameterValues, 'parameterValues (card)', 'index', 'value', onChange));
            c.appendChild(buttonsEditor(card.buttons, onChange));
            cardsWrap.appendChild(c);
          });
          const addCard = el('button','btn btn-add btn-small','+ add card');
          addCard.type='button';
          addCard.addEventListener('click', ()=>{
            state.cards.push({mediaUrl:'', mediaType:'IMAGE', parameterValues:[], buttons:[]});
            redrawCards(); onChange();
          });
          cardsWrap.appendChild(addCard);
        }
        redrawCards();
        holder.appendChild(cardsWrap);
        break;
      }
      case 'auth': {
        const codeF = el('div','field full'); codeF.style.marginBottom='10px';
        codeF.innerHTML = '<label>parameterValues[0] — auth code</label>';
        const codeInp = el('input'); codeInp.type='text'; codeInp.placeholder='1234';
        codeInp.value = (state.parameterValues[0] && state.parameterValues[0].value) || '';
        codeInp.addEventListener('input', ()=>{
          state.parameterValues[0] = {idx:'0', value: codeInp.value};
          onChange();
        });
        codeF.appendChild(codeInp);
        holder.appendChild(codeF);
        if(state.buttons.length === 0){
          state.buttons.push({type:'URL', text:'Copy Code', payload:'', index:0});
        }
        holder.appendChild(buttonsEditor(state.buttons, onChange));
        break;
      }
    }
  }

  // Builds the JSON "message" object for a template state
  function templateToMessageObject(state){
    const tpl = {};
    tpl.templateId = state.templateId || '';
    if(state.templateUId) tpl.templateUId = state.templateUId;

    if(['image','pdf','video'].includes(state.type) && state.mediaUrl){
      const media = { url: state.mediaUrl, type: state.mediaType };
      if(state.type === 'image'){ media.caption = state.mediaCaption || ''; media.mimeType = null; }
      if(state.mediaFileName) media.fileName = state.mediaFileName;
      tpl.media = media;
    }

    // parameterValues only applies to formats the docs show it on: video,
    // buttons (text+vars), header_buttons, carousel (message bubble text), and auth.
    const TYPES_WITH_PARAM_VALUES = ['video','buttons','header_buttons','carousel','auth'];
    if(TYPES_WITH_PARAM_VALUES.includes(state.type) && state.parameterValues && state.parameterValues.length){
      const pv = {};
      state.parameterValues.forEach(p=>{ if(p.idx!=='') pv[p.idx] = p.value; });
      if(Object.keys(pv).length) tpl.parameterValues = pv;
    }
    if(state.type === 'header_buttons' && state.headerParameterValues && state.headerParameterValues.length){
      const hv = {};
      state.headerParameterValues.forEach(p=>{ if(p.idx!=='') hv[p.idx] = p.value; });
      if(Object.keys(hv).length) tpl.headerParameterValues = hv;
    }
    // Top-level buttons only apply to formats the docs actually show buttons on:
    // image, pdf, buttons (text+vars), header_buttons, and auth. "text", "video",
    // and "carousel" (which nests buttons per-card instead) never emit this key —
    // even if button data is sitting in state from a previously-used format.
    const TYPES_WITH_TOP_LEVEL_BUTTONS = ['image','pdf','buttons','header_buttons','auth'];
    if(TYPES_WITH_TOP_LEVEL_BUTTONS.includes(state.type) && state.buttons && state.buttons.length){
      tpl.buttons = state.buttons.map(b=>{
        const btn = { index: isNaN(parseInt(b.index)) ? 0 : parseInt(b.index), text: b.text||'', type: b.type };
        if(b.type === 'URL'){ if(b.url) btn.url = b.url; }
        if(b.payload !== undefined && b.payload !== '') btn.payload = b.payload;
        return btn;
      });
    }
    if(state.type === 'carousel' && state.cards && state.cards.length){
      tpl.cards = state.cards.map(card=>{
        const c = { media: { url: card.mediaUrl||'', type: card.mediaType||'IMAGE' } };
        if(card.parameterValues && card.parameterValues.length){
          const pv = {};
          card.parameterValues.forEach(p=>{ if(p.idx!=='') pv[p.idx]=p.value; });
          if(Object.keys(pv).length) c.parameterValues = pv;
        }
        if(card.buttons && card.buttons.length){
          c.buttons = card.buttons.map(b=>{
            const btn = { text:b.text||'', type:b.type };
            if(b.type==='URL' && b.url) btn.url = b.url;
            if(b.payload!==undefined && b.payload!=='') btn.payload = b.payload;
            btn.index = isNaN(parseInt(b.index)) ? 0 : parseInt(b.index);
            return btn;
          });
        }
        return c;
      });
    }
    return { template: tpl };
  }

  // ============================================================
  // METADATA TAG EDITOR (tag1, tag2, tag3 ... free-form key/value)
  // ============================================================
  function metaEditor(container, addBtnId, list, onChange){
    const addBtn = $(addBtnId);
    function redraw(){
      container.innerHTML = '';
      list.forEach((item, i)=>{
        const row = el('div','kv-row');
        const keyInp = el('input'); keyInp.type='text'; keyInp.placeholder='tag1'; keyInp.value=item.key;
        keyInp.addEventListener('input', ()=>{ item.key = keyInp.value; onChange(); });
        const valInp = el('input'); valInp.type='text'; valInp.placeholder='value'; valInp.value=item.value;
        valInp.addEventListener('input', ()=>{ item.value = valInp.value; onChange(); });
        const rm = el('button','btn-remove','✕'); rm.type='button';
        rm.addEventListener('click', ()=>{ list.splice(i,1); redraw(); onChange(); });
        row.appendChild(keyInp); row.appendChild(valInp); row.appendChild(rm);
        container.appendChild(row);
      });
    }
    addBtn.onclick = ()=>{ list.push({key:'tag'+(list.length+1), value:''}); redraw(); onChange(); };
    redraw();
  }

  // ============================================================
  // STATE: recipients for many-to-many, meta lists, single-send template
  // ============================================================
  const oneMeta = [{key:'tag1', value:''}];
  const singleMeta = [];
  const manyRecipients = []; // [{id, to, shortenUrl, deptId, callbackUrl, meta:[], tplState}]
  const singleTplState = makeTemplateState('text');

  function newRecipient(){
    return {
      id: uid(), to:'', shortenUrl:false, deptId:'', callbackUrl:'',
      meta:[{key:'tag1', value:''}], tplState: makeTemplateState('text'), usePlainText:true, plainText:''
    };
  }

  function renderManyRecipients(){
    const wrap = $('manyRecipients');
    wrap.innerHTML = '';
    manyRecipients.forEach((rec, i)=>{
      const card = el('div','card');
      const head = el('div','card-head');
      head.appendChild(el('span','card-label','recipient '+i));
      if(manyRecipients.length > 1){
        const rm = el('button','btn-remove','remove'); rm.type='button';
        rm.addEventListener('click', ()=>{ manyRecipients.splice(i,1); renderManyRecipients(); renderCurl(); });
        head.appendChild(rm);
      }
      card.appendChild(head);

      const grid = el('div','field-grid');
      const toF = el('div','field'); toF.innerHTML='<label>to</label>';
      const toInp = el('input'); toInp.type='text'; toInp.value=rec.to; toInp.placeholder='+916261282518';
      toInp.addEventListener('input', ()=>{ rec.to = toInp.value; renderCurl(); });
      toF.appendChild(toInp); grid.appendChild(toF);

      const deptF = el('div','field'); deptF.innerHTML='<label>deptId <span class="opt">optional</span></label>';
      const deptInp = el('input'); deptInp.type='text'; deptInp.value=rec.deptId; deptInp.placeholder='100';
      deptInp.addEventListener('input', ()=>{ rec.deptId = deptInp.value; renderCurl(); });
      deptF.appendChild(deptInp); grid.appendChild(deptF);

      const shortF = el('div','field'); shortF.innerHTML='<label>shortenUrl</label>';
      const shortSel = el('select');
      ['false','true'].forEach(v=>{const o=el('option');o.value=v;o.textContent=v;if(String(rec.shortenUrl)===v)o.selected=true;shortSel.appendChild(o);});
      shortSel.addEventListener('change', ()=>{ rec.shortenUrl = shortSel.value==='true'; renderCurl(); });
      shortF.appendChild(shortSel); grid.appendChild(shortF);

      const cbF = el('div','field full'); cbF.innerHTML='<label>callbackUrl <span class="opt">optional</span></label>';
      const cbInp = el('input'); cbInp.type='text'; cbInp.value=rec.callbackUrl; cbInp.placeholder='https://webhook.site/...';
      cbInp.addEventListener('input', ()=>{ rec.callbackUrl = cbInp.value; renderCurl(); });
      cbF.appendChild(cbInp); grid.appendChild(cbF);

      card.appendChild(grid);

      // message: plain text vs template
      const chipRow = el('div','tpl-type-row'); chipRow.style.marginTop='4px';
      const plainChip = el('button','tpl-chip'+(rec.usePlainText?' active':''),'Plain text'); plainChip.type='button';
      const tplChip = el('button','tpl-chip'+(!rec.usePlainText?' active':''),'Template'); tplChip.type='button';
      chipRow.appendChild(plainChip); chipRow.appendChild(tplChip);
      card.appendChild(chipRow);

      const msgHolder = el('div');
      card.appendChild(msgHolder);

      function drawMsg(){
        msgHolder.innerHTML = '';
        if(rec.usePlainText){
          const f = el('div','field full'); f.innerHTML='<label>message.text</label>';
          const ta = el('textarea'); ta.rows=2; ta.value=rec.plainText; ta.placeholder='many to many user one';
          ta.addEventListener('input', ()=>{ rec.plainText = ta.value; renderCurl(); });
          f.appendChild(ta); msgHolder.appendChild(f);
        } else {
          const fieldsHolder = el('div');
          const chooser = buildTemplateTypeChooser(rec.tplState, ()=>{ renderCurl(); }, ()=>{ renderTemplateFields(fieldsHolder, rec.tplState, renderCurl); });
          msgHolder.appendChild(chooser);
          msgHolder.appendChild(fieldsHolder);
          renderTemplateFields(fieldsHolder, rec.tplState, renderCurl);
        }
      }
      plainChip.addEventListener('click', ()=>{ rec.usePlainText=true; plainChip.classList.add('active'); tplChip.classList.remove('active'); drawMsg(); renderCurl(); });
      tplChip.addEventListener('click', ()=>{ rec.usePlainText=false; tplChip.classList.add('active'); plainChip.classList.remove('active'); drawMsg(); renderCurl(); });
      drawMsg();

      // metadata
      const metaTitle = el('div','hint','metaData'); metaTitle.style.margin='10px 0 6px';
      card.appendChild(metaTitle);
      const metaWrap = el('div');
      card.appendChild(metaWrap);
      metaEditorInline(metaWrap, rec.meta, renderCurl);
      const addMetaBtn = el('button','btn btn-add btn-small','+ add metadata tag'); addMetaBtn.type='button';
      addMetaBtn.addEventListener('click', ()=>{ rec.meta.push({key:'tag'+(rec.meta.length+1), value:''}); metaEditorInline(metaWrap, rec.meta, renderCurl); renderCurl(); });
      card.appendChild(addMetaBtn);

      wrap.appendChild(card);
    });
  }

  // a metaEditor variant that doesn't need a button id (inline buttons used instead)
  function metaEditorInline(container, list, onChange){
    container.innerHTML = '';
    list.forEach((item, i)=>{
      const row = el('div','kv-row');
      const keyInp = el('input'); keyInp.type='text'; keyInp.placeholder='tag1'; keyInp.value=item.key;
      keyInp.addEventListener('input', ()=>{ item.key = keyInp.value; onChange(); });
      const valInp = el('input'); valInp.type='text'; valInp.placeholder='value'; valInp.value=item.value;
      valInp.addEventListener('input', ()=>{ item.value = valInp.value; onChange(); });
      const rm = el('button','btn-remove','✕'); rm.type='button';
      rm.addEventListener('click', ()=>{ list.splice(i,1); metaEditorInline(container, list, onChange); onChange(); });
      row.appendChild(keyInp); row.appendChild(valInp); row.appendChild(rm);
      container.appendChild(row);
    });
  }

  // ============================================================
  // ROUTING FIELD (channelId+from for bulk, journeyId+from+channel for single)
  // ============================================================
  function renderRoutingGrid(){
    const grid = $('routingGrid');
    grid.innerHTML = '';
    if(mode === 'bulk-one' || mode === 'bulk-many'){
      grid.appendChild(fieldHTML('channelId','channelId','686e585a9b7d504221880f19','channelId'));
      grid.appendChild(fieldHTML('from','from','+919784565547','fromBulk'));
      if(mode === 'bulk-one'){
        grid.appendChild(fieldHTML('channel','channel <span class="opt">optional, e.g. WhatsApp</span>','WhatsApp','bulkChannel'));
      }
    } else {
      grid.appendChild(fieldHTML('journeyId','journeyId','61af2d2cfc1da74a16ea7927','journeyId'));
      grid.appendChild(fieldHTML('from','from','+918565565943','fromSingle'));
      grid.appendChild(fieldHTML('to','to <span class="opt">— shown again below too</span>','','toSingleTop', true));
      grid.appendChild(fieldHTML('channel','channel','WhatsApp','singleChannel'));
    }
  }
  function fieldHTML(label, labelHtml, placeholder, id, hideLabel){
    const f = el('div','field');
    f.innerHTML = `<label>${labelHtml}</label>`;
    const inp = el('input'); inp.type='text'; inp.id=id; inp.placeholder=placeholder;
    inp.addEventListener('input', renderCurl);
    f.appendChild(inp);
    if(hideLabel) f.style.display = 'none';
    return f;
  }

  // ============================================================
  // PRESETS
  // ============================================================
  function loadPreset(name){
    if(name === 'bulk-one-text'){
      $('host').value = 'https://waba.vialogue.io';
      $('authToken').value = 'n6IK2D562QrHAC+\QQfXZJCEMLuKFgxM9RtZPclQQfXZJCEMLuKFgxM9RtZPcl';
      switchMode('bulk-one');
      $('channelId').value = '6a0eb453f96df5d553f93d6142';
      $('fromBulk').value = '+919999999999';
      $('toListText').value = '+919999999991\n+919999999992';
      $('oneDeptId').value = '100';
      $('oneCallbackUrl').value = 'https://webhook.com';
      const wrap = $('oneMsgBuilder');
      wrap.querySelector('.tpl-chip').click(); // ensure plain text selected (first chip)
      $('oneTextValue').value = 'common message to all users';
      $('oneTextValue').dispatchEvent(new Event('input'));
      oneMeta.length = 0; oneMeta.push({key:'tag1', value:'meta data 1'});
      renderOneMeta();
    }
    if(name === 'bulk-one-template'){
      $('host').value = 'https://waba.vialogue.io';
      $('authToken').value = 'f2oAKACwSvjkrN8iilucIvnYfXZJCEMLuKFgxM9RtZPclrN8iilucIvnYfXZJCEMLuKFgxM9RtZPcl';
      switchMode('bulk-one');
      $('channelId').value = '6a0eb453f93d614253f93d6142';
      $('fromBulk').value = '+919999999999';
      $('bulkChannel').value = 'WhatsApp';
      $('toListText').value = '+919999999991\n+919999999992';
      $('oneShortenUrl').value = 'true';
      const wrap = $('oneMsgBuilder');
      const state = wrap._getState().tplState;
      state.templateId = 'downloadthereport_2026';
      state.parameterValues = [{idx:'0', value:'AMAN'}];
      state.buttons = [{type:'URL', text:'Download Report', payload:'https://example.com/report.pdf', index:0}];
      wrap._useTemplateWithType('buttons'); // text template w/ parameterValues + a URL button
      oneMeta.length = 0;
      renderOneMeta();
    }
    renderCurl();
  }

  function renderOneMeta(){
    metaEditor($('oneMetaWrap'), 'oneAddMeta', oneMeta, renderCurl);
  }

  // ============================================================
  // MODE SWITCHING
  // ============================================================
  function switchMode(newMode){
    mode = newMode;
    document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active', b.dataset.mode===newMode));
    $('panel-bulk-one').style.display = newMode==='bulk-one' ? '' : 'none';
    $('panel-bulk-many').style.display = newMode==='bulk-many' ? '' : 'none';
    $('panel-single').style.display = newMode==='single' ? '' : 'none';
    $('presetRow').style.display = newMode==='bulk-one' ? '' : 'none';

    const copy = {
      'bulk-one': {
        eyebrow:'Bulk Send Message API', title:'One message to many users',
        sub:'Send a single common message — plain text or a full template — to a list of recipient numbers in one request.'
      },
      'bulk-many': {
        eyebrow:'Bulk Send Message API', title:'Different message to different users',
        sub:'Send personalized text or templates to each recipient, with per-recipient metadata and callback URLs, in one request.'
      },
      'single': {
        eyebrow:'Send Message API', title:'Single message via journey',
        sub:'Send one templated WhatsApp message to one recipient through a configured journey.'
      }
    }[newMode];
    $('modeEyebrow').textContent = copy.eyebrow;
    $('modeTitle').textContent = copy.title;
    $('modeSub').textContent = copy.sub;

    renderRoutingGrid();
    renderCurl();
  }

  // ============================================================
  // BUILD REQUEST BODY OBJECTS
  // ============================================================
  function buildBulkOneBody(){
    const body = {};
    body.channelId = $('channelId').value || '';
    body.from = $('fromBulk').value || '';
    if($('bulkChannel') && $('bulkChannel').value) body.channel = $('bulkChannel').value;
    body.type = 'oneToMany';
    const dept = $('oneDeptId').value;
    if(dept) body.deptId = isNaN(dept) ? dept : Number(dept);
    body.toList = $('toListText').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const cb = $('oneCallbackUrl').value;
    if(cb) body.callbackUrl = cb;
    body.shortenUrl = $('oneShortenUrl').value === 'true';

    const wrap = $('oneMsgBuilder');
    const state = wrap._getState ? wrap._getState() : {useTemplate:false};
    if(state.useTemplate){
      body.message = templateToMessageObject(state.tplState);
    } else {
      body.message = { text: wrap.dataset.text || '' };
    }

    const meta = {};
    oneMeta.forEach(m=>{ if(m.key) meta[m.key] = m.value; });
    if(Object.keys(meta).length) body.metaData = meta;

    return body;
  }

  function buildBulkManyBody(){
    const body = {};
    body.channelId = $('channelId').value || '';
    body.from = $('fromBulk').value || '';
    body.type = 'manyToMany';
    body.messages = manyRecipients.map(rec=>{
      const m = { to: rec.to || '' };
      m.shortenUrl = !!rec.shortenUrl;
      m.message = rec.usePlainText ? { text: rec.plainText || '' } : templateToMessageObject(rec.tplState);
      const meta = {};
      rec.meta.forEach(x=>{ if(x.key) meta[x.key] = x.value; });
      if(Object.keys(meta).length) m.metaData = meta;
      if(rec.deptId) m.deptId = isNaN(rec.deptId) ? rec.deptId : Number(rec.deptId);
      if(rec.callbackUrl) m.callbackUrl = rec.callbackUrl;
      return m;
    });
    return body;
  }

  function buildSingleBody(){
    const body = {};
    body.journeyId = $('journeyId').value || '';
    body.from = $('fromSingle').value || '';
    body.to = $('singleTo').value || '';
    if($('singleChannel').value) body.channel = $('singleChannel').value;
    if($('singleShortenUrl').value) body.shortenUrl = $('singleShortenUrl').value;
    const dept = $('singleDeptId').value;
    if(dept) body.deptId = dept;
    const cb = $('singleCallbackUrl').value;
    if(cb) body.callbackUrl = cb;

    const meta = {};
    singleMeta.forEach(m=>{ if(m.key) meta[m.key] = m.value; });
    if(Object.keys(meta).length) body.metaData = meta;

    body.message = templateToMessageObject(singleTplState);
    return body;
  }

  // ============================================================
  // CURL RENDERING (with light syntax highlighting + validation)
  // ============================================================
  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function highlightCurl(text){
    // Highlight quoted strings, --flags, and the host URL, line by line, safely.
    const lines = text.split('\n');
    return lines.map(line=>{
      let escaped = escapeHtml(line);
      // highlight leading curl / flags
      escaped = escaped.replace(/^(curl)\b/, '<span class="prompt-tag">$1</span>');
      escaped = escaped.replace(/(--location|--header|--data|-X|-H|-d)(?=\s)/g, '<span class="tok-flag">$1</span>');
      // highlight single-quoted strings
      escaped = escaped.replace(/(&#39;[^&#39;]*&#39;)/g, '<span class="tok-string">$1</span>');
      return escaped;
    }).join('\n');
  }

  function jsonForCurl(obj){
    // pretty JSON, single-quote safe (we don't expect literal single quotes in values typically,
    // but if present, escape by closing/opening quote per POSIX shell convention)
    return JSON.stringify(obj, null, 4);
  }

  function shellSingleQuoteSafe(str){
    // POSIX-safe single quoting: close quote, escaped single quote, reopen quote
    return str.replace(/'/g, `'"'"'`);
  }

  function validate(body, mode){
    const errors = [];
    if(mode === 'bulk-one' || mode === 'bulk-many'){
      if(!body.channelId) errors.push('channelId is required.');
      if(!body.from) errors.push('from is required.');
      if(mode === 'bulk-one' && (!body.toList || body.toList.length===0)) errors.push('toList needs at least one recipient number.');
      if(mode === 'bulk-many' && (!body.messages || body.messages.length===0)) errors.push('Add at least one recipient.');
      if(mode === 'bulk-many'){
        body.messages.forEach((m,i)=>{ if(!m.to) errors.push(`Recipient ${i}: "to" is required.`); });
      }
    } else {
      if(!body.journeyId) errors.push('journeyId is required.');
      if(!body.from) errors.push('from is required.');
      if(!body.to) errors.push('to is required.');
      if(!singleTplState.templateId) errors.push('templateId is required.');
    }
    if(!$('authToken').value) errors.push('authentication-token is empty — request will fail auth.');
    return errors;
  }

  function renderCurl(){
    const host = ($('host').value || '').replace(/\/$/, '');
    const token = $('authToken').value || '';

    let endpoint, body;
    if(mode === 'bulk-one'){
      endpoint = host + '/chatbird/api/message/bulk/send';
      body = buildBulkOneBody();
    } else if(mode === 'bulk-many'){
      endpoint = host + '/chatbird/api/message/bulk/send';
      body = buildBulkManyBody();
    } else {
      endpoint = host + '/chatbird/api/message/send';
      body = buildSingleBody();
    }

    const jsonStr = jsonForCurl(body);
    const safeJson = shellSingleQuoteSafe(jsonStr);
    const safeToken = shellSingleQuoteSafe(token);
    const safeEndpoint = shellSingleQuoteSafe(endpoint);

    const curl =
`curl --location '${safeEndpoint}' \\
--header 'authentication-token: ${safeToken}' \\
--header 'Content-Type: application/json' \\
--data '${safeJson}'`;

    $('curlOutput').innerHTML = highlightCurl(curl) + '<span class="cursor-blink"></span>';

    // meta line
    const recipientCount = mode==='bulk-one' ? (body.toList||[]).length
      : mode==='bulk-many' ? (body.messages||[]).length : 1;
    $('outMeta').innerHTML =
      `<span>endpoint: <b>${escapeHtml(endpoint.replace(host,'').replace(/^.*\/\/[^/]+/,'')|| endpoint)}</b></span>` +
      `<span>method: <b>POST</b></span>` +
      `<span>recipients: <b>${recipientCount}</b></span>` +
      `<span>payload size: <b>${jsonStr.length} chars</b></span>`;

    const errors = validate(body, mode);
    const box = $('errorBox');
    if(errors.length){
      box.innerHTML = `<div class="error-box"><b>Heads up — before you run this</b>${errors.map(e=>'• '+escapeHtml(e)).join('<br>')}</div>`;
    } else {
      box.innerHTML = '';
    }
  }

  // ============================================================
  // SINGLE SEND template builder mount
  // ============================================================
  function renderSingleTplBuilder(){
    const holder = $('singleTplBuilder');
    holder.innerHTML = '';
    const fieldsHolder = el('div');
    const chooser = buildTemplateTypeChooser(singleTplState, ()=>{ renderCurl(); }, ()=>{ renderTemplateFields(fieldsHolder, singleTplState, renderCurl); });
    holder.appendChild(chooser);
    holder.appendChild(fieldsHolder);
    renderTemplateFields(fieldsHolder, singleTplState, renderCurl);
  }

  // ============================================================
  // WIRE UP
  // ============================================================
  document.querySelectorAll('.mode-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> switchMode(btn.dataset.mode));
  });

  document.querySelectorAll('.preset-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> loadPreset(btn.dataset.preset));
  });

  $('host').addEventListener('input', renderCurl);
  $('authToken').addEventListener('input', renderCurl);
  $('toListText').addEventListener('input', renderCurl);
  $('oneDeptId').addEventListener('input', renderCurl);
  $('oneShortenUrl').addEventListener('change', renderCurl);
  $('oneCallbackUrl').addEventListener('input', renderCurl);
  $('manyAddRecipient').addEventListener('click', ()=>{ manyRecipients.push(newRecipient()); renderManyRecipients(); renderCurl(); });
  $('singleTo').addEventListener('input', renderCurl);
  $('singleDeptId').addEventListener('input', renderCurl);
  $('singleCallbackUrl').addEventListener('input', renderCurl);
  $('singleShortenUrl').addEventListener('change', renderCurl);

  $('copyBtn').addEventListener('click', ()=>{
    const text = $('curlOutput').innerText;
    navigator.clipboard.writeText(text).then(()=>{
      const btn = $('copyBtn');
      const original = btn.textContent;
      btn.textContent = '✓ copied';
      btn.classList.add('copied');
      setTimeout(()=>{ btn.textContent = original; btn.classList.remove('copied'); }, 1400);
    });
  });

  // init
  renderOneToManyMessageBuilder();
  renderOneMeta();
  metaEditor($('singleMetaWrap'), 'singleAddMeta', singleMeta, renderCurl);
  manyRecipients.push(newRecipient());
  manyRecipients.push(newRecipient());
  renderManyRecipients();
  renderSingleTplBuilder();
  switchMode('bulk-one');

})();
