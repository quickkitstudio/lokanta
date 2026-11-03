/* ==========================================================================
   ŞİRKET SINIRLARI — kasa, müşteri uygulaması ve şirket paneli birlikte kullanır.
   Bu dosyayı değiştirmenize gerek yok.
   ========================================================================== */
(function () {
  var GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  var KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  var para = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
  function tl(n) { return para.format(Math.round((Number(n) || 0) * 100) / 100); }
  function sayi(v) { if (v === null || v === undefined || v === '') return null; var n = Number(v); return isFinite(n) && n >= 0 ? n : null; }
  function iki(n) { return String(n).padStart(2, '0'); }

  // Şirketin genel kuralı + kişiye özel kural → o kişi için geçerli kural
  function birlestir(sirket, kisi) {
    sirket = sirket || {}; kisi = kisi || {};
    if (kisi.sinirsiz) return { sinirsiz: true, kategori: {} };
    function al(a) { var k = sayi(kisi[a]); return k !== null ? k : sayi(sirket[a]); }
    var gunler = Array.isArray(sirket.gunler) && sirket.gunler.length > 0 && sirket.gunler.length < 7 ? sirket.gunler : null;
    return {
      sinirsiz: false,
      gunlukOgun: al('gunlukOgun'), aylikOgun: al('aylikOgun'), aylikTutar: al('aylikTutar'), ogunTutar: al('ogunTutar'),
      gunler: gunler, saatBas: sirket.saatBas || null, saatBit: sirket.saatBit || null,
      kategori: sirket.kategori || {}
    };
  }

  // Şirketin onayladığı ekstra haklar → o gün için geçerli kural
  // ekler: [{ tur: 'gunlukOgun'|'aylikOgun'|'aylikTutar'|'gunSinirsiz', miktar, gun, ay }]
  function etkin(limit, ekler, gun) {
    if (!limit || limit.sinirsiz) return limit;
    var ay = String(gun || '').slice(0, 7), e = { gunlukOgun: 0, aylikOgun: 0, aylikTutar: 0, gunSinirsiz: false };
    (ekler || []).forEach(function (h) {
      if (!h || !h.tur) return;
      var n = Number(h.miktar) || 0;
      if (h.tur === 'gunSinirsiz' && h.gun === gun) e.gunSinirsiz = true;
      if (h.tur === 'gunlukOgun' && h.gun === gun) e.gunlukOgun += n;
      if (h.tur === 'aylikOgun' && h.ay === ay) e.aylikOgun += n;
      if (h.tur === 'aylikTutar' && h.ay === ay) e.aylikTutar += n;
    });
    if (e.gunSinirsiz) return { sinirsiz: true, bugunSerbest: true, kategori: {} };
    var l = {};
    for (var k in limit) l[k] = limit[k];
    if (l.gunlukOgun !== null) l.gunlukOgun += e.gunlukOgun;
    if (l.aylikOgun !== null) l.aylikOgun += e.aylikOgun;
    if (l.aylikTutar !== null) l.aylikTutar += e.aylikTutar;
    l.ekVar = e.gunlukOgun + e.aylikOgun + e.aylikTutar > 0;
    return l;
  }

  // Ekstra hakkın okunabilir hali
  function ekMetni(h) {
    if (!h || !h.tur) return '';
    var n = Number(h.miktar) || 0;
    if (h.tur === 'gunSinirsiz') return 'Bir günlük sınırsız hak (' + gunYaz(h.gun) + ')';
    if (h.tur === 'gunlukOgun') return '+' + n + ' öğün (' + gunYaz(h.gun) + ')';
    if (h.tur === 'aylikOgun') return 'Bu ay +' + n + ' öğün';
    if (h.tur === 'aylikTutar') return 'Bu ay +' + tl(n);
    return '';
  }
  function gunYaz(g) { var p = String(g || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : g; }

  // siparis: { kalemler, toplam, zamanMs, gun }
  // gecmis : aynı kişinin AYNI AY içindeki onaylanmış diğer siparişleri [{ gun, toplam }]
  // ekler  : şirketin onayladığı ekstra haklar (isteğe bağlı)
  // Dönüş  : kural ihlallerinin listesi (boşsa sipariş uygundur)
  function kontrol(limit, siparis, gecmis, ekler) {
    var h = [];
    limit = etkin(limit, ekler, siparis.gun);
    if (!limit || limit.sinirsiz) return h;
    gecmis = gecmis || [];
    var t = new Date(siparis.zamanMs || Date.now());
    if (limit.gunler && limit.gunler.indexOf(t.getDay()) < 0) h.push(GUNLER[t.getDay()] + ' günü yemek hakkı yok');
    if (limit.saatBas || limit.saatBit) {
      var hm = iki(t.getHours()) + ':' + iki(t.getMinutes());
      if ((limit.saatBas && hm < limit.saatBas) || (limit.saatBit && hm > limit.saatBit)) h.push('Yemek saati ' + (limit.saatBas || '00:00') + '–' + (limit.saatBit || '23:59') + ' arası');
    }
    var toplam = Number(siparis.toplam) || 0;
    if (limit.ogunTutar !== null && toplam > limit.ogunTutar + 0.001) h.push('Öğün başına en fazla ' + tl(limit.ogunTutar));
    var say = {};
    (siparis.kalemler || []).forEach(function (k) { var c = k.kategori || 'Diğer'; say[c] = (say[c] || 0) + (Number(k.adet) || 1); });
    Object.keys(limit.kategori || {}).forEach(function (c) {
      var m = sayi(limit.kategori[c]);
      if (m === null || (say[c] || 0) <= m) return;
      h.push(m === 0 ? c + ' kapalı' : c + ': öğün başına en fazla ' + m + ' adet');
    });
    var bugun = gecmis.filter(function (s) { return s.gun === siparis.gun; }).length;
    if (limit.gunlukOgun !== null && bugun + 1 > limit.gunlukOgun) h.push(limit.gunlukOgun === 0 ? 'Yemek hakkı yok' : 'Günlük öğün hakkı doldu (' + limit.gunlukOgun + ')');
    if (limit.aylikOgun !== null && gecmis.length + 1 > limit.aylikOgun) h.push('Aylık öğün hakkı doldu (' + limit.aylikOgun + ')');
    var ayToplam = gecmis.reduce(function (a, s) { return a + (Number(s.toplam) || 0); }, 0);
    if (limit.aylikTutar !== null && ayToplam + toplam > limit.aylikTutar + 0.001) h.push('Aylık tutar sınırı aşılıyor (kalan ' + tl(Math.max(0, limit.aylikTutar - ayToplam)) + ')');
    return h;
  }

  // Kuralların okunabilir listesi
  function ozet(limit) {
    var l = [];
    if (!limit) return l;
    if (limit.sinirsiz) return ['Sınırsız'];
    if (limit.gunlukOgun !== null) l.push('Günde en fazla ' + limit.gunlukOgun + ' öğün');
    if (limit.aylikOgun !== null) l.push('Ayda en fazla ' + limit.aylikOgun + ' öğün');
    if (limit.aylikTutar !== null) l.push('Aylık en fazla ' + tl(limit.aylikTutar));
    if (limit.ogunTutar !== null) l.push('Öğün başına en fazla ' + tl(limit.ogunTutar));
    if (limit.gunler) {
      var g = limit.gunler.slice().sort();
      l.push(g.join(',') === '1,2,3,4,5' ? 'Sadece hafta içi' : 'Sadece ' + g.map(function (i) { return KISA[i]; }).join(', '));
    }
    if (limit.saatBas || limit.saatBit) l.push('Saat ' + (limit.saatBas || '00:00') + '–' + (limit.saatBit || '23:59') + ' arası');
    Object.keys(limit.kategori || {}).sort().forEach(function (c) {
      var m = sayi(limit.kategori[c]);
      if (m !== null) l.push(m === 0 ? c + ' kapalı' : c + ': en fazla ' + m);
    });
    return l;
  }

  window.SINIR = { birlestir: birlestir, etkin: etkin, kontrol: kontrol, ozet: ozet, ekMetni: ekMetni, GUNLER: GUNLER, KISA: KISA, sayi: sayi };
})();
