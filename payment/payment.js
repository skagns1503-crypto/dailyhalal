/* Browser receives the publishable client key only. Approval stays on the server. */
(function(){
  'use strict';
  var EXEC="https://script.google.com/macros/s/AKfycbwzZXuo_767PmTXSaEOl7_eeZDzvkzzZruxNrueNg6aOK60m-2MsbI4tuYULoPrnsgk/exec", payment, callback, sess, widgets, methodWidget;
  var message=document.getElementById('message'), pay=document.getElementById('pay'), retry=document.getElementById('retry');
  function say(text){message.textContent=text;}
  function read(store,key){try{return JSON.parse(store.getItem(key)||'null');}catch(e){return null;}}
  function remove(key){try{sessionStorage.removeItem(key);}catch(e){}}
  async function api(fn,arg){
    if(EXEC.indexOf('https://script.google.com/macros/s/')!==0)throw Error('결제 서버 연결을 준비 중입니다.');
    var response=await fetch(EXEC,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:fn,arg:arg})});
    if(!response.ok)throw Error('서버 연결이 불안정합니다. 승인 결과를 다시 확인해 주세요.');
    var result=await response.json();
    if(!result.ok)throw Error(result.err&&result.err.ko || '결제 결과 확인이 필요합니다. 다시 결제하지 마세요.');
    return result;
  }
  async function confirm(){
    retry.hidden=true;retry.disabled=true;say('서버에서 결제 승인 결과를 확인하고 있습니다.');
    try{
      await api('apiPaymentConfirm',{sess:sess,orderId:callback.orderId,paymentKey:callback.paymentKey,amount:callback.amount});
      remove('dailyhalal.payment.callback');remove('dailyhalal.payment');
      say('테스트 결제 승인을 확인했습니다. 주문 내역에서 상태를 확인하실 수 있습니다.');
    }catch(e){say(e.message);retry.hidden=false;}finally{retry.disabled=false;}
  }
  async function start(){
    var params=new URLSearchParams(location.search), result=params.get('result');
    // Remove callback parameters before loading any third-party SDK.
    if(location.search)history.replaceState(null,'',location.pathname);
    payment=read(sessionStorage,'dailyhalal.payment');
    sess=read(localStorage,'dailyhalal.go.sess');
    if(!payment||!payment.checkout||!sess){say('로그인한 주문 화면에서 결제를 시작해 주세요.');return;}
    var c=payment.checkout;
    if(c.mode!=='test'||!/^test_gck_/.test(c.clientKey)){say('테스트 결제 설정을 확인해야 합니다.');return;}
    document.getElementById('order').textContent='주문 '+payment.order;
    document.getElementById('amount').textContent=Number(c.amount).toLocaleString('ko-KR')+'원';
    callback=read(sessionStorage,'dailyhalal.payment.callback');
    if(result==='success'){
      if(params.get('orderId')!==c.orderId || Number(params.get('amount'))!==c.amount || !params.get('paymentKey')){
        say('저장된 주문과 결제 정보가 다릅니다. 다시 결제하지 말고 주문 상태를 확인해 주세요.');return;
      }
      callback={orderId:c.orderId,paymentKey:params.get('paymentKey'),amount:c.amount};
      try{sessionStorage.setItem('dailyhalal.payment.callback',JSON.stringify(callback));}
      catch(e){say('브라우저 저장이 차단돼 있습니다. 주문 상태를 확인해 주세요.');return;}
    }
    if(callback){
      if(callback.orderId!==c.orderId){say('이전 결제의 처리 결과를 확인해야 합니다. 다시 결제하지 마세요.');return;}
      await confirm();return;
    }
    if(result==='fail'){say('결제 인증이 완료되지 않았습니다. 주문 내역에서 상태를 확인한 뒤 다시 시도해 주세요.');return;}
    if(Date.now()>=Number(c.expiresMs)){say('결제 준비 시간이 지났습니다. 주문 화면에서 다시 시작해 주세요.');return;}
    try{
      await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='https://js.tosspayments.com/v2/standard';script.onload=resolve;script.onerror=function(){reject(Error('결제 화면을 불러오지 못했습니다.'));};document.head.appendChild(script);});
      widgets=TossPayments(c.clientKey).widgets({customerKey:c.customerKey});
      await widgets.setAmount({currency:'KRW',value:c.amount});
      var rendered=await Promise.all([widgets.renderPaymentMethods({selector:'#methods',variantKey:'DEFAULT'}),widgets.renderAgreement({selector:'#agreement',variantKey:'AGREEMENT'})]);
      methodWidget=rendered[0];
      say('카드를 선택하고 테스트 결제를 진행해 주세요.');pay.hidden=false;
    }catch(e){say(e.message||'결제 화면을 준비하지 못했습니다.');}
  }
  pay.addEventListener('click',async function(){
    pay.disabled=true;
    try{
      var selected=await methodWidget.getSelectedPaymentMethod();
      if(selected.method!=='CARD')throw Error('현재는 카드결제만 테스트할 수 있습니다. 카드를 선택해 주세요.');
      var c=payment.checkout;
      await widgets.requestPayment({orderId:c.orderId,orderName:c.orderName,
        successUrl:location.origin+'/payment/?result=success',failUrl:location.origin+'/payment/?result=fail'});
    }catch(e){say(e.message||'결제 요청을 완료하지 못했습니다.');}finally{pay.disabled=false;}
  });
  retry.addEventListener('click',confirm);
  start().catch(function(){say('결제 정보를 확인하지 못했습니다. 주문 내역을 확인해 주세요.');});
})();
