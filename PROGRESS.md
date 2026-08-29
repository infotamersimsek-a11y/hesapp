# Gelir-Gider Takip Sitesi — İlerleme Kaydı

## Proje Özeti
Gelir/gider takip web uygulaması. Kullanıcı gelir/gider ekler, kategori bazlı raporlar görür, bakiye takip eder.

## Durum: Planlama aşaması

---

## Veri Modeli (Detay)

### Dükkan (Shop)
- 2 sabit dükkan: **Hacıoğulları**, **Çıtır Tatlı**

### Günlük İşlemler (Daily)
- **Gelir:** dükkan bazlı nakit giriş (tarih, dükkan, tutar)
- **Gider:** günlük harcama (tarih, dükkan, kategori [yemek, temizlik, vb], tutar, açıklama)

### Aylık İşlemler (Monthly)
- **Gelir:** YOK artık — nakit + POS gelirinin ikisi de günlük girilir, aylık ekran sadece o ayın toplamını otomatik hesaplayıp gösterir (bkz. karar değişikliği aşağıda)
- **Gider:** sabit harcama — firma bazlı (ay/yıl, dükkan, firma adı, kategori, tutar)
  - örnek firmalar: elektrik, su, kira, internet vb sabit ödeme yapılan yerler

### Özet/Rapor ihtiyacı
- Günlük bakiye = nakit gelir - günlük gider
- Aylık bakiye = (nakit toplam + POS toplam) - (günlük gider toplam + sabit gider toplam)
- Dükkan bazlı karşılaştırma

## Yapılacaklar (Backlog)
- [ ] Tech stack seç (frontend/backend/db) — kullanıcıya soruldu, cevap bekleniyor
- [ ] Proje iskeleti kur
- [ ] Dükkan yönetimi (2 sabit dükkan, isim gir)
- [ ] Günlük nakit gelir ekleme (dükkan seç, tutar, tarih)
- [ ] Günlük gider ekleme (dükkan, kategori, tutar, tarih)
- [x] Aylık POS gelir ekleme — İPTAL: POS artık günlük girilir (bkz. karar değişikliği)
- [ ] Aylık sabit gider ekleme (dükkan, firma, kategori, ay, tutar)
- [ ] Kategori yönetimi (gider kategorileri: yemek, temizlik, vb — CRUD)
- [ ] Sabit gider firmaları yönetimi (CRUD)
- [ ] Günlük özet ekranı (dükkan bazlı, toplam)
- [ ] Aylık özet ekranı (dükkan bazlı, gelir/gider/bakiye)
- [ ] Grafik/rapor (aylık trend, dükkan karşılaştırma)
- [ ] Veri export (CSV/Excel)
- [ ] Deploy
- [x] PWA: ana ekrana ekleme (manifest+ikon+sw)
- [x] Sesle gelir/gider ekleme (Groq Whisper+LLM, onay ekranlı)
- [x] POS fiş fotoğrafı okuma (Groq vision, onay ekranlı)

## Kararlar
- İki dükkan var, tüm işlemler dükkan bazlı ayrı tutulacak
- Günlük seviye: nakit gelir + günlük giderler (yemek, temizlik vb kategoriler)
- **[GÜNCELLENDİ 2026-08-27] POS geliri artık AYLIK değil GÜNLÜK giriliyor.** `daily_income` tablosuna `method` kolonu eklendi (`nakit` | `pos`). `monthly_income` tablosu kaldırıldı. Aylık ekran, o ayın günlük kayıtlarından nakit+POS toplamını otomatik hesaplar.
- Aylık seviye: sadece sabit giderler kaldı (firma bazlı, örn elektrik/su/kira)
- **Tech stack: React (frontend) + Node/Express (backend) + PostgreSQL (db)**
- **DB hosting: Neon (cloud Postgres, ücretsiz tier)** — local'de postgres/docker yok, cloud tercih edildi
- **AI sağlayıcı: Groq API** — sesle giriş (Whisper transkript) + POS fiş foto okuma (vision) + serbest konuşmayı yapılandırılmış işleme çevirme (LLM) hepsi tek Groq key ile. Kullanıcı kendi Groq API key'ini sağlayacak.
- **Onay akışı: AI ile eklenen her işlem (ses/foto) kaydetmeden önce kullanıcıya onay ekranında gösterilir**, düzenlenebilir, sonra "Onayla ve Kaydet" ile normal CRUD endpoint'lerine gider. Yanlış duyma/okuma riskine karşı otomatik kaydetme yok.

## Log
- 2026-08-27: Proje başlatıldı. PROGRESS.md oluşturuldu.
- 2026-08-27: Veri modeli netleşti — 2 dükkan, günlük (nakit gelir/gider) + aylık (POS gelir/sabit gider) ayrımı.
- 2026-08-27: Tech stack seçildi — React + Node/Express + PostgreSQL.
- 2026-08-27: Server iskeleti kuruldu (`server/`) — Express + pg, route'lar: shops, daily-income, daily-expense, monthly-income, monthly-expense, summary.
- 2026-08-27: DB şeması yazıldı (`server/schema.sql`) — 2 dükkan seed edilir (Hacıoğulları, Çıtır Tatlı).
- 2026-08-27: Client iskeleti kuruldu (`client/`, Vite+React) — Günlük/Aylık sekmeli UI, `DailyTab.jsx` + `MonthlyTab.jsx`.
- 2026-08-27: npm install tamam (server+client), build test edildi, server ayakta olduğu doğrulandı (DB bağlantısı olmadan 500 dönüyor, çökmüyor).
- 2026-08-27: `server/src/preview.js` + `DB_MODE=memory` eklendi (pg-mem) — Neon olmadan `npm run preview` ile anlık test ortamı. `npm run preview` (server) + `npm run dev` (client) ile localhost:5173 üzerinden görsel test yapıldı.
- 2026-08-27: DailyTab güncellendi — artık tek gün filtresi yok, dükkan bazlı TÜM günler tarih gruplu liste halinde gösteriliyor (gelir+gider birlikte, gün başı toplam+bakiye). Ekleme formu hâlâ tarih seçilebilir (geçmişe/ileriye kayıt girilebilir).
- 2026-08-27: Geçmiş görünümü ikiye bölündü — Gelir Geçmişi ve Gider Geçmişi artık ayrı sütunlarda (grid), birbirine karışmıyor.
- 2026-08-27: **Büyük değişiklik — POS geliri günlüğe taşındı + AI destekli giriş eklendi:**
  - `daily_income` tablosuna `method` (`nakit`/`pos`) kolonu eklendi, `monthly_income` tablosu tamamen kaldırıldı (schema.sql, dailyIncome.js, summary.js güncellendi)
  - `server/src/routes/ai.js` eklendi — Groq API ile 2 endpoint: `POST /api/ai/voice-entry` (ses dosyası → Whisper transkript → LLM ile yapılandırılmış işlem listesi), `POST /api/ai/receipt-entry` (fiş fotoğrafı → vision model → POS tutarı)
  - `multer` eklendi (ses/foto multipart upload için)
  - `client/src/VoiceEntry.jsx` — mikrofon kaydı (MediaRecorder API), Groq'a gönderim, çıkan işlemler onay ekranında düzenlenebilir liste halinde gösterilir, "Onayla ve Kaydet" ile normal create endpoint'lerine yazılır
  - DailyTab'a "Gelir Ekle" formuna Nakit/POS seçici eklendi, geçmiş listesinde her satırda Nakit/POS etiketi var
  - MonthlyTab'dan POS manuel giriş formu kaldırıldı — aylık özet artık günlük kayıtlardan otomatik hesaplanıyor
  - Backend test edildi (preview modunda): shops, daily-income (method=pos ile), summary/monthly, summary/daily hepsi doğru çalışıyor. `GROQ_API_KEY` olmadan ai route'ları çökme yerine düzgün 400 hatası dönüyor.
  - Client build temiz geçti.
- 2026-08-27: **Foto/OCR (fiş tarama) özelliği kaldırıldı** — kullanıcı isteği: POS de dahil her şey sesle girilecek, kamera gerekmiyor. `ReceiptScan.jsx`, `/api/ai/receipt-entry` route'u, `api.receiptEntry`, `GROQ_VISION_MODEL` silindi. VoiceEntry zaten `method: pos` çıkarabiliyor (örn "200 lira pos geldi").
- 2026-08-27: **Dükkan seçimi dropdown yerine buton oldu.** `ShopSwitcher.jsx` eklendi (DailyTab + MonthlyTab ortak kullanıyor) — Hacıoğulları / Çıtır Tatlı iki büyük buton, tıklanan aktif olur, veriler ona yazılır. Dokunmatik kullanım için daha hızlı.
- 2026-08-27: Gider kategorileri güncellendi — "Nakliye" kaldırıldı, "Kişisel Giderler" ve "Ekstra Giderler" eklendi. Güncel liste: Yemek, Temizlik, Kişisel Giderler, Ekstra Giderler, Diğer. (DailyTab.jsx, VoiceEntry.jsx, server ai.js prompt'u güncellendi.)
- 2026-08-27: MonthlyTab "Sabit Gider Ekle" formu hazır seçenekli oldu — Kira, Elektrik, Su, Doğalgaz, Ev Kirası, Diğer. "Diğer" seçilirse özel isim girilebiliyor. Ev Kirası dükkana özgü değil ama şimdilik hangi dükkan seçiliyse onun altına kaydediliyor (şema değişmedi, `monthly_expense.shop_id` hâlâ zorunlu).
- 2026-08-27: Sabit gider listesine tedarikçi firmalar eklendi — Ambalaj, Lale Gıda, Örgün Gıda, Coca-Cola.
- 2026-08-27: Geçmiş listelerindeki tarih gösterimi düzeltildi — ham ISO string ("2026-08-27T00:00:00.000Z") yerine "27 Ağustos 2026" formatında gösteriliyor (`Intl.DateTimeFormat('tr-TR', ...)`).
- 2026-08-27: **Tarih kilidi eklendi (audit/anti-fraud kontrolü).** Günlük gelir/gider kaydı SADECE bugünün tarihine girilebilir — ne geçmişe ne geleceğe kayıt eklenemez (`server/src/dateGuard.js` → `assertIsToday`). Tarih seçici arayüzden kaldırıldı, hep "bugün" kullanılıyor. Geçmiş günlerin kayıtları silinemez (sadece bugünkü kayıtlar silinebilir) — `DELETE ... WHERE id=$1 AND date=$2 (bugün)`, aksi halde 403. Geçmiş gün kartları arayüzde kırmızı çerçeve + "Kilitli" etiketiyle gösteriliyor, silme butonu görünmüyor. Hem backend hem frontend'de uygulandı (backend asıl güvence, frontend sadece UX).
  - Not: İlk halde "geçmişe ekleme serbest, silme yasak" olarak yapılmıştı; kullanıcı sonra "geriye dönük veri eklenemeyecek" diyerek daha sıkı hale getirdi — düzeltildi.
- 2026-08-27: **Çoklu kullanıcı canlı senkron (SSE) eklendi.** İki kişi aynı anda kullanabilir, biri veri ekleyince diğerinin ekranı otomatik yenilenir. `server/src/events.js` (in-memory client listesi + broadcast) + `GET /api/events` (Server-Sent Events stream). `daily-income`, `daily-expense`, `monthly-expense`, `credit-cards` yazma işlemlerinin hepsi broadcast tetikliyor. Frontend: `client/src/useLiveRefresh.js` hook'u (`new EventSource('/api/events')`), DailyTab/MonthlyTab/CreditCardsTab hepsi kullanıyor — event gelince o sekmenin verisi yeniden çekiliyor. Test edildi: bir sekmede ekleme yapılınca SSE event doğru geldi.
- 2026-08-27: **Kredi Kartları — yeni 3. sekme eklendi** (Günlük/Aylık gibi ayrı alan, kullanıcı isteği). `credit_cards` tablosu: ad, güncel borç, hesap kesim günü (1-31), son ödeme günü (1-31), not. Dükkana bağlı değil (ortak/genel liste). Backend (`server/src/routes/creditCards.js`) her istekte kesim/son ödeme günlerinden bir sonraki gerçek tarihi hesaplıyor (ay sonu taşması dahil, örn gün=31 Şubat'ta 28/29'a düşer) ve son ödemeye kaç gün kaldığını (`days_until_due`) döndürüyor. **Son ödemeye 3 gün veya daha az kaldıysa `due_soon:true`, arayüzde kart kırmızı çerçeveli + "Son ödemeye N gün" etiketiyle gösteriliyor.** Kart listesi son ödeme tarihine göre sıralı (en yakın önce). Borç tutarı ayrı bir mini formla güncellenebiliyor (aylık ekstre değiştikçe).
  - Backend test edildi: kart ekleme, borç güncelleme, silme, 3-gün-kala uyarı hesabı (`due_day` bugüne 2 gün kala → `due_soon:true`) doğru çalıştı.
- 2026-08-27: **Kritik saat dilimi hatası bulundu ve düzeltildi.** Sunucu makine `Europe/Istanbul` (UTC+3). `new Date().toISOString().slice(0,10)` gibi kod, "bugün"ü UTC'ye çevirip yanlış gün üretiyordu (özellikle gece yarısına yakın saatlerde ve kredi kartı sonraki-tarih hesaplarında bir gün kayma oluyordu — ör. son ödeme günü 5 iken "2026-09-04" gibi yanlış hesaplanmıştı). Hem `server/src/dateGuard.js` (`todayStr`) hem `client/src/DailyTab.jsx` (`today`) hem `server/src/routes/creditCards.js` (`toDateStr`) düzeltildi — artık `getFullYear/getMonth/getDate` ile LOKAL tarih string'i manuel oluşturuluyor, `toISOString` kullanılmıyor. Düzeltme sonrası kredi kartı tarihleri doğrulandı.

- 2026-08-27: **Kredi kartı — kayıt dışı tutar analizi (mütabakat) eklendi.** Kullanıcı karar verdi: "gider eklerken kart seçilsin" (kaba toplam değil, doğru bağlı karşılaştırma).
  - Şema: `credit_card_debt_log` (kart_id, tutar, kayıt zamanı) — kart oluşturulduğunda ve her borç güncellemesinde otomatik log satırı eklenir, böylece borcun zaman içindeki geçmişi tutulur. `daily_expense` ve `monthly_expense` tablolarına nullable `credit_card_id` eklendi.
  - Gider Ekle formlarına (Günlük + Aylık) "Ödeme kartı" seçici eklendi (opsiyonel, boşsa nakit/pos sayılır). Geçmiş listelerinde hangi kartla ödendiği etiket olarak görünüyor.
  - `GET /api/credit-cards` artık her kart için `reconciliation` objesi döndürüyor: `debt_start_of_month` (ay başında en son bilinen borç, log'dan), `card_spend_estimate` (bu ay borç artışı = şimdiki borç − ay başı borç), `recorded_expense_this_month` (o karta bağlı kayıtlı giderler toplamı), `discrepancy` (aradaki fark), `flagged` (fark >1₺ ise true).
  - Arayüzde her kartın altında "Bu Ay Mütabakat" kutusu: fark varsa kırmızı "⚠ Kayıt dışı olabilecek tutar: X ₺", tutarlıysa yeşil "✓ Tutarlı", ay başı borç kaydı yoksa "Yetersiz veri" (yeni kart için ilk ay bu duruma düşer, bir dahaki ay itibariyle hesaplanır — dürüstçe belirtiliyor, yanlış sayı üretilmiyor).
  - **Sınırlama (bilerek basit tutuldu):** hesap faiz/komisyon farkını ayırt etmiyor, borç artışını doğrudan harcama sayıyor. Sesli girişte kart seçimi yok (sadece manuel formda) — istenirse eklenebilir.
  - Test edildi: kart oluşturuldu, gidere kart bağlandı, mütabakat objesinde `recorded_expense_this_month` doğru arttı, `debt_start_of_month` olmadığı için (yeni kart) doğru şekilde "yetersiz veri" durumuna düştü.
  - **Not:** Bir karta bağlı gider kaydı varsa o kart silinemiyor (foreign key koruması) — veri kaybını önlüyor, kasıtlı.
- 2026-08-27: **10 placeholder kart eklendi** (Kart A — Kart J), kullanıcı gerçek verileri (isim, borç, kesim/son ödeme günü) verince tek tek güncellenecek. `schema.sql`'e seed eklendi (tablo boşsa otomatik eklenir, migrate ile kalıcı) + çalışan preview sunucusuna da canlı eklendi.

## Bekleyen — Findeks PDF İçe Aktarma (henüz yapılmadı)
Kullanıcı Findeks'ten kredi kartı raporu PDF'i yükleyip kartların otomatik doldurulmasını istiyor. **Kullanıcı örnek PDF gönderecek** — format netleşmeden (metin tabanlı mı, taranmış görüntü mü) kod yazılmayacak, çünkü çözüm yöntemi (pdf-parse ile metin çıkarma vs. OCR/vision) formata göre değişir.

## Gerçek Ortama Geçildi (Neon + Groq) — Artık Preview Değil
- 2026-08-27: `npx skills add neondatabase/agent-skills -s neon -s neon-postgres -y` ile Neon agent-skill kuruldu (`.agents/skills/neon`, `.agents/skills/neon-postgres`).
- Neon CLI kuruldu ve yetkilendirildi (`neon auth`, tarayıcıdan OAuth login).
- Workspace, kullanıcının verdiği projeye bağlandı: proje **veri** (`wispy-star-49815990`), organizasyon **Tamer** (`org-solitary-surf-08342124`), branch `production`. Bağlantı bilgisi `server/.neon` dosyasında (git-ignored).
- `neon env pull` ile gerçek `DATABASE_URL` çekildi (`server/.env.local` → birleştirilip `server/.env`'e yazıldı).
- Kullanıcının verdiği Groq API key `server/.env`'e yazıldı (`GROQ_API_KEY`).
- `npm run migrate` gerçek Neon Postgres'e karşı çalıştırıldı — şema kuruldu, 2 dükkan + 10 placeholder kart (Kart A-J) seed edildi.
- Bellek-içi preview sunucusu durduruldu, **gerçek sunucu** (`node --watch src/index.js`, port 4000) gerçek Neon DB ile ayakta. Test edildi: `/api/shops`, `/api/credit-cards` gerçek veriyi doğru döndürdü.
- Client (Vite, port 5173) zaten `/api`'yi 4000'e proxy'liyordu, otomatik gerçek sunucuya bağlandı — ekstra işlem gerekmedi.
- **Artık kalıcı:** girdiğin veriler artık kaybolmuyor (önceki preview modu her restart'ta sıfırlanıyordu).
- Neon AI Gateway de otomatik provision edilmiş görünüyor (`.env.local`'de `NEON_AI_GATEWAY_*` değişkenleri var) ama uygulama onu kullanmıyor — ses/görsel işleri hâlâ Groq'un kendi API'si üzerinden gidiyor, karışıklık olmasın diye .env'e alınmadı.

## Gerçek Kart Verileri Girildi + Kredi Kartları Ekranı İnce Ayar
- 2026-08-27: Gerçek kart verileri girilmeye başlandı: **Yapı Kredi - Kredi Kartı** (87 bin ₺, kesim 13/son ödeme 23), **Yapı Kredi - Esnek Hesap** (40 bin ₺, kredi kartından bağımsız satır — sabit ödeme tarihi olmadığı için kesim/son ödeme günü nominal 1 girildi), **Ziraat Bankası - Kredi Kartı** (50 bin ₺, kesim 12/son ödeme 24). Kalan placeholder kartlar (Kart D-J) veri bekliyor.
  - **Not (önemli, tekrar etmemek için):** Bash üzerinden Türkçe karakter içeren `curl -d` komutu çalıştırınca karakterler bozuluyordu (`Yapı` → `Yap�`) — gerçek DB'ye yanlış veri yazılmıştı, fark edilip node script dosyası üzerinden (Write tool ile UTF-8 dosya yazıp `node script.mjs` çalıştırarak) düzeltildi. **Bundan sonra Türkçe metin içeren API çağrıları hep dosya üzerinden yapılacak, doğrudan bash komut satırına Türkçe karakter yazılmayacak.**
- 2026-08-27: "Bu Ay Mütabakat" kutusu kullanıcı isteğiyle arayüzden kaldırıldı (kod/backend hesaplaması duruyor, sadece görünmüyor).
- 2026-08-27: Para birimi gösterimi "bin" formatına çevrildi (`client/src/format.js`, `formatMoney`) — "87000.00 ₺" yerine "87 bin ₺" gösteriliyor. Gerçek değer DB'de tam hassasiyetle duruyor, sadece ekranda kısaltılıyor.
- 2026-08-27: Kart bilgi etiketleri renklendirildi: Borç = kırmızı, Son Ödeme = yeşil, Hesap Kesim = koyu sarı, hepsi kalın (`.label-debt`, `.label-due`, `.label-statement`).
- 2026-08-27: "Ödeme Yapıldı" özelliği eklendi, sonra kullanıcı isteğiyle "Borcu Güncelle" ile aynı satıra, TEK tutar kutusunu paylaşacak şekilde birleştirildi (`DebtActions` bileşeni) — bir tutar gir, ya "Borcu Güncelle" (yeni toplam borç olarak yazar) ya "Ödeme Yapıldı" (mevcut borçtan düşer) butonuna bas. "Borcu Güncelle" koyu kırmızı, "Ödeme Yapıldı" yeşil.
- 2026-08-27: Layout taşma hatası düzeltildi — dar kart sütununda tutar kutusu + 2 buton bazı kartlarda alt satıra kayıyordu (tutarsız görünüyordu). Tutar kutusu 60px'e sabitlendi (`flex:1` yerine `flex: 0 0 60px`), buton padding/font küçültüldü, satır `flex-wrap: nowrap` yapıldı.
- 2026-08-27: **Banka kurumsal renkleri** eklendi (`client/src/bankColors.js`, `getBankColor`) — kart adında banka ismi geçiyorsa (Yapı Kredi, Ziraat, Garanti, İş Bankası, Akbank, Halkbank, VakıfBank, QNB, DenizBank, TEB, ING, HSBC, Kuveyt Türk, Enpara vb.) o bankanın kurumsal rengiyle sol kenarlık + isim rengi gösteriliyor. Tanınmayan banka gri kalıyor.
- 2026-08-27: **Kart Ekle formu banka dropdown'una çevrildi** — serbest metin yerine Türkiye'de faaliyet gösteren ~27 banka listesinden seçim (`TURKISH_BANKS`), + "Diğer" ile listede olmayan için serbest giriş. Ayrıca ürün türü seçici eklendi: Kredi Kartı / Esnek Hesap / İhtiyaç Kredisi / Diğer. İkisi birleşip kart adını oluşturuyor (örn "Ziraat Bankası - Kredi Kartı").
- 2026-08-27: Build her adımda temiz geçti, canlı Neon DB üzerinde test edildi.
- 2026-08-27: **Placeholder kartlar (Kart D-J) silindi.** Kullanıcı artık organik büyüme istiyor — kartlar sadece gerçekten eklendikçe görünecek, önceden boş placeholder listesi olmayacak. `schema.sql`'deki 10-kart otomatik seed bloğu da kaldırıldı (yeni kurulumda artık boş liste ile başlar). Kart A/B/C zaten gerçek verilerle (Yapı Kredi x2, Ziraat) değiştirilmişti, D-J canlı DB'den silindi.
- 2026-08-27: **Kart arka planı banka rengine çevrildi.** `.credit-card` artık `getBankColor()` ile tam banka renginde arka plan kullanıyor (sadece sol kenarlık değil). Yazı rengi `getContrastText()` ile otomatik hesaplanıyor (koyu renk arka planda beyaz yazı, açık renkte koyu yazı — okunabilirlik garantili). Borç/Son Ödeme/Hesap Kesim etiketleri artık renkli metin değil, ana yazıyla aynı (kontrastlı) renkte + önlerinde renkli nokta (●) işareti (kırmızı/yeşil/sarı) — böylece her banka renginde okunaklı kalıyor, kod anlamı korunuyor.
- 2026-08-27: **Banka listesi 27'den en yaygın 10'a indirildi** (Ziraat, İş Bankası, Garanti BBVA, Yapı Kredi, Akbank, Halkbank, VakıfBank, QNB Finansbank, DenizBank, TEB) + "Diğer". **Logo eklendi**: `getBankLogo()` (`bankColors.js`) Clearbit'in ücretsiz logo servisinden (`logo.clearbit.com/<domain>`) her banka için domain bazlı logo çekiyor. Kart Ekle formundaki banka seçici artık `<select>` değil, logo+isim gösteren tıklanabilir buton grid'i (`.bank-picker`) — HTML `<option>` içine resim konamadığı için bu şekilde yapıldı. Var olan kart kutucuklarının başlığına da banka logosu eklendi. Logo yüklenemezse (internet yok / Clearbit domain bulamazsa) görsel sessizce gizleniyor, sayfa bozulmuyor.
  - **Not:** Logolar üçüncü parti serviste barındırılıyor (Clearbit), uygulamaya gömülü değil — internet bağlantısı gerektirir, gerçek banka logosu marka/telif hakkı üçüncü partiye ait, sadece görsel tanıma kolaylığı için kullanılıyor.
- 2026-08-27: **Clearbit logoları güvenilir çıkmadı** (kullanıcının ekranında hepsi boş/kırık kutu olarak göründü) — `getBankLogo()` tamamen kaldırıldı, `.bank-picker` butonları artık logo yerine banka renginde arka plan/kenarlık kullanıyor (seçili buton dolu renk, seçili olmayan renkli kenarlıklı). Kart kutucuklarındaki logo görseli de kaldırıldı (zaten kart arka planı banka renginde, logo gereksizdi). Artık hiçbir yerde dış servise (Clearbit) bağımlılık yok, tamamen CSS/renk tabanlı — internet olmasa da çalışır.

## Canlıya Alındı — Vercel (https://hesapalr.vercel.app)
- 2026-08-27: **Kullanıcı "public_html/test klasörüne zip at" istedi** — açıklandı: normal paylaşımlı hosting (public_html) Node.js sunucu ÇALIŞTIRAMAZ, sadece dosya sunar. Uygulamanın backend'i (Express) veritabanına bağlanan, Groq key'ini gizleyen, iş kurallarını (tarih kilidi, mütabakat, vb) çalıştıran SÜREKLİ ÇALIŞAN bir program — statik dosya olarak kopyalanamaz.
- 2026-08-27: Önce Railway önerildi, kullanıcı itiraz etti ("neden gerek var, hosting paketim yeterli"). Sonra kullanıcı **Vercel**'i sordu — Vercel'in sunucusuz (serverless) fonksiyonlar kullandığı, bu yüzden mevcut SSE (anlık canlı senkron) çalışmayacağı açıklandı. Kullanıcı polling'e geçişi kabul etti (Vercel karşılığında).
- 2026-08-27: **SSE tamamen kaldırıldı, yerine polling geldi.** `server/src/events.js` + `server/src/routes/events.js` silindi, `broadcast()` çağrıları dailyIncome/dailyExpense/monthlyExpense/creditCards route'larından temizlendi. `client/src/useLiveRefresh.js` artık `EventSource` yerine `setInterval` ile 7 saniyede bir `reload()` çağırıyor — arayüz kodu (`useLiveRefresh(reload)` çağrıları) hiç değişmedi, sadece hook'un içi değişti.
- 2026-08-27: **Backend Vercel serverless fonksiyonuna uyarlandı.** `server/src/index.js` ikiye bölündü: `server/src/app.js` (Express app'i kurar, `app.listen()` YOK, sadece `export default app`) ve `server/src/index.js` (sadece local dev/preview için `app.listen()` çağırır — `npm run dev`/`npm run preview` hâlâ eskisi gibi çalışıyor, değişmedi). Yeni `api/index.js` (proje kökünde) `server/src/app.js`'i import edip Vercel'in beklediği formatta export ediyor — Express app'i doğrudan bir serverless fonksiyon olarak çalışıyor.
- 2026-08-27: Kök dizine `package.json` (`"type":"module"`, Vercel'in ESM olarak tanıması için), `vercel.json` (build: `client` içinde `npm run build`, output: `client/dist`, `/api/*` isteklerini `api/index.js` fonksiyonuna yönlendiren rewrite) ve `.vercelignore` (`.env`, `.env.local`, `.neon`, `node_modules`, `dist` — gizli bilgiler/gereksiz dosyalar yüklenmesin diye) eklendi.
- 2026-08-27: `npx vercel login` ile giriş yapıldı (e-posta + device code, tarayıcıda onaylandı), proje `tamoeer/hesapalr` olarak oluşturuldu/bağlandı. `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_WHISPER_MODEL`, `GROQ_TEXT_MODEL` Vercel production ortamına `vercel env add` ile eklendi (gizli/secret olarak saklanıyor, panelden görünmez).
- 2026-08-27: `vercel --prod` ile deploy edildi. **Canlı adres: https://hesapalr.vercel.app** — test edildi, `/api/shops` ve `/api/credit-cards` gerçek Neon verisini doğru döndürdü, ana sayfa (React arayüzü) 200 döndü.
- **Sıradaki potansiyel iş:** Kullanıcı isterse bu Vercel adresini kendi alan adına (domain) bağlayabilir (Vercel ayarlarından custom domain ekleme, DNS CNAME/A kaydı) — public_html'e zip atmaya hiç gerek kalmadı, tamamen Vercel üzerinden yayında.

## GitHub'a Taşındı — Otomatik Deploy Pipeline Kuruldu
- 2026-08-27: Kullanıcı GitHub repo oluşturdu (`https://github.com/infotamersimsek-a11y/hesapp.git`) ve Vercel'i GitHub'a bağladı. **Proje git deposuna alındı** — daha önce git repo değildi (`git init`). Kök `.gitignore` eklendi (`node_modules`, `.env*`, `.neon`, `.vercel`, `.claude`, `.agents`, `skills-lock.json` — sırlar ve araç/tooling dosyaları hariç, sadece uygulama kodu commit'leniyor).
- Git kullanıcı kimliği bu repoya özel (local, `--global` değil) ayarlandı: `smsktmr@gmail.com` / `Tamer`.
- İlk commit + `git push -u origin main` ile GitHub'a yüklendi.
- **Vercel projesi (`tamoeer/hesapalr`) `npx vercel git connect` ile bu GitHub reposuna bağlandı** — böylece `main`'e her push otomatik yeni production deploy'u tetikliyor (mevcut projeye bağlandı, env değişkenleri korunuyor; yeni/ayrı proje oluşmadı). Test edildi: bir commit push edildi, ~15sn içinde yeni deployment otomatik oluştu ve `Ready` oldu.
- **Kullanıcı talebi (kalıcı kural, unutma):** Bundan sonraki her kod değişikliğinde `git add/commit/push` yapılacak — bu hem GitHub'da yedekli tutar hem Vercel'deki canlı siteyi otomatik günceller. Ayrı "deploy et" komutuna gerek yok, push yeterli.

## iOS/Android PWA — Mobil "Ana Ekrana Ekle" İnce Ayarı
- 2026-08-27: Kullanıcı isteği: telefonlarda tarayıcıdan "Ana Ekrana Ekle" ile uygulama modunda kusursuz çalışsın, tüm sekmeler test edilsin.
- `client/index.html`: `apple-mobile-web-app-status-bar-style` (black-translucent — durum çubuğu içerikle uyumlu), `mobile-web-app-capable` (Android/Chrome için), `format-detection: telephone=no` (iOS'un sayısal tutarları otomatik telefon numarası linkine çevirmesini engeller — finans uygulaması için önemli, yoksa "50000" gibi tutarlar mavi altı çizili link gibi görünür), `viewport-fit=cover` (çentikli/Dynamic Island'lı telefonlarda güvenli alan desteği) eklendi.
- `manifest.webmanifest`: `id`, `lang: "tr"`, `display_override: ["standalone","minimal-ui"]` eklendi (Chrome'un kurulum tutarlılığı için).
- `App.css`: `env(safe-area-inset-*)` ile çentik/home-indicator alanlarına taşma önlendi, `overscroll-behavior-y: contain` ile iOS'ta sayfa "zıplama" efekti bastırıldı, butonlara `-webkit-tap-highlight-color: transparent` + `touch-action: manipulation` (gri tıklama flaşı yok, ~300ms dokunma gecikmesi yok — daha "native app" hissi). `.tabs` (Günlük/Aylık/Kredi Kartları) dar ekranda taşmasın diye `flex-wrap` + esnek buton genişliği eklendi.
- **Sınırlama (dürüstçe belirtildi):** Bu ortamda gerçek iOS/Android cihaz ya da tarayıcı emülasyon aracı yok — değişiklikler PWA/mobil best-practice'lere göre kod/CSS seviyesinde yapıldı ve build/manifest doğruluğu (geçerli JSON, doğru `Content-Type: application/manifest+json`, meta etiketlerin canlı sitede çıktığı) test edildi, ama gerçek cihazda görsel/dokunma testi yapılamadı. **Kullanıcının telefonundan gerçek "Ana Ekrana Ekle" testi yapıp geri bildirmesi gerekiyor.**
- Değişiklikler commit edilip push edildi, Vercel otomatik deploy etti, canlı sitede meta etiketler + manifest doğrulandı (`curl` ile).

## Şifre Koruması Eklendi (site herkese açıktı, kapatıldı)
- 2026-08-27: Kullanıcı fark etti — site herkese açık, veriler herkes tarafından görülebiliyordu. **Backend seviyesinde gerçek koruma** eklendi (sadece arayüzde gizleme değil — API'ye direkt istek atılsa da artık engelleniyor).
- Şifre kullanıcı tarafından belirlendi: `142536` (tek şifre, iki kullanıcı da paylaşıyor — ayrı hesap sistemi yok, tek giriş ekranı).
- **Mimari: JWT tabanlı stateless oturum** (Vercel serverless olduğu için session/cookie store yerine imzalı token seçildi):
  - `server/src/auth.js`: `signToken()` (30 gün geçerli JWT üretir), `checkPassword()` (zamanlamaya dayanıklı `crypto.timingSafeEqual` ile şifre kıyaslar, timing attack'a karşı), `requireAuth` middleware (Authorization header'da geçerli JWT yoksa 401).
  - `server/src/routes/auth.js`: `POST /api/auth/login` — şifre doğruysa token döner.
  - `server/src/app.js`: `/api/auth` route'u AÇIK, ondan sonraki `app.use('/api', requireAuth)` satırı geri kalan TÜM `/api/*` rotalarını kilitliyor (shops, daily-income, daily-expense, monthly-expense, summary, ai, credit-cards — hepsi artık token istiyor).
  - `client/src/auth.js`: token `localStorage`'da saklanıyor, `login()` fonksiyonu var.
  - `client/src/Login.jsx`: basit şifre giriş ekranı.
  - `client/src/App.jsx`: token yoksa direkt Login ekranını gösteriyor, veri çekmiyor.
  - `client/src/api.js`: her istekte `Authorization: Bearer <token>` header'ı otomatik ekleniyor; sunucu 401 dönerse token siliniyor ve sayfa yenilenip login ekranına dönülüyor (oturum süresi dolunca / şifre değişince otomatik toparlanır).
  - Env: `APP_PASSWORD`, `JWT_SECRET` (rastgele 96 karakter hex, `crypto.randomBytes(48)` ile üretildi) — hem `server/.env` (local) hem Vercel production'a eklendi.
- **Bulunan bug:** İlk yazımda `auth.js`'de `const SECRET = process.env.JWT_SECRET` modül seviyesinde (import anında) okunuyordu — ama `dotenv.config()` `app.js`'de imports'lardan SONRA çalışıyor, yani `auth.js` import edildiğinde `JWT_SECRET` henüz yüklenmemiş oluyordu (ESM import sırası tuzağı). Belirti: doğru şifre bile "Şifre yanlış" / `secretOrPrivateKey must have a value` hatası veriyordu. **Düzeltme:** `process.env.JWT_SECRET`'i fonksiyon içinde (çağrı anında) okumaya çevirdik, modül seviyesinde cache'lemedik.
- **Ayrıca öğrenildi:** `node --watch` sadece import edilen JS/mjs dosyalarını izliyor, `.env` dosyasını İZLEMİYOR — `.env` değiştiğinde sunucu otomatik yeniden başlamıyor, elle restart gerekiyor. Bundan sonra `.env` değişikliği yapılınca bunu hatırla.
- Local'de tam test edildi (şifresiz 401, yanlış şifre 401, doğru şifre → token → korumalı route 200), sonra canlıda (`hesapalr.vercel.app`) aynı testler tekrarlandı, hepsi doğru çalıştı.
- Commit edilip push edildi, Vercel otomatik deploy etti.

## Kullanıcı Gerçek Cihazda Test Etti — Bug Bulundu ve Düzeltildi
- 2026-08-27: Kullanıcı iPhone'da (Safari, hesapalr.vercel.app) uygulamayı gerçekten kullandı — giriş ekranı, sekmeler, gider ekleme çalıştı. **Sesle Ekle'de hata çıktı:** `404 model_not_found — llama-3.3-70b-versatile does not exist`. Groq bu modeli kataloğundan kaldırmış.
- Groq'un güncel model listesi canlı API'den çekildi (`GET /v1/models`) — mevcut modeller arasından `openai/gpt-oss-120b` seçildi, JSON mode + Türkçe çıktı ile test edildi (gerçek örnek: "500 lira nakit geldi, 200 lira pos geldi, 50 lira temizlik gideri oldu" → doğru 3 işleme ayrıştı). `GROQ_TEXT_MODEL` hem `server/.env` hem Vercel production'da güncellendi, `server/src/routes/ai.js`'deki fallback default'u da güncellendi. `GROQ_WHISPER_MODEL` (whisper-large-v3) değişmedi, hâlâ mevcut.
  - **Not:** Groq'un model kataloğu zaman zaman değişiyor/modeller kaldırılıyor — ileride yine "model_not_found" hatası çıkarsa aynı yöntemle (`GET https://api.groq.com/openai/v1/models` ile Bearer key kullanarak) güncel listeyi çekip `GROQ_TEXT_MODEL`/`GROQ_WHISPER_MODEL`'i güncelle.
- Kullanıcı ayrıca "konuşurken aynı anda metne çevrilsin" istedi (gerçek zamanlı canlı transkript). Açıklandı: bu, iPhone Safari'de desteklenmeyen bir tarayıcı özelliği (Web Speech API) gerektirir; tam platformlar-arası gerçek zamanlı çözüm için ücretli streaming STT servisi (Deepgram vb.) + belirgin ek geliştirme gerekir. **Kullanıcı karar verdi: mevcut akış (konuş → bırak → 1-2 saniyede metne çevrilir) yeterli, ek servis kurulmayacak.**

## Dekont Fotoğrafı ile Gider Ekleme — Yeniden Eklendi (Farklı Amaçla)
- 2026-08-28: Kullanıcı isteği: "gelen ürünler ile ilgili dekontu atacağım, gider kısmına kaydedecek" — tedarikçiden gelen mal/ürünler için ödeme dekontu/fişi fotoğraflanıp otomatik gider kaydı oluşturulsun.
- **Not:** Daha önce (27 Ağustos) POS fiş okuma özelliği kullanıcı isteğiyle tamamen kaldırılmıştı ("her şey sesle girilecek, kamera gerekmiyor"). Bu farklı bir kullanım — POS/gelir değil, **tedarikçi ödeme dekontu → gider** — o yüzden ayrı, yeniden eklendi.
- Önce Groq'ta hangi vision (görsel okuyabilen) modelin hâlâ mevcut olduğu kontrol edildi (geçmişte kullanılan `llama-3.2-90b-vision-preview` artık yok, tıpkı metin modelinin kaldırılması gibi). Groq'un resmi dokümantasyonu kontrol edildi: şu an sadece **`qwen/qwen3.6-27b`** ve **`qwen/qwen3.8-27b`** görsel destekliyor. `qwen/qwen3.8-27b` gerçek bir görselle test edildi (base64 image_url + JSON mode), çalıştığı doğrulandı.
- `server/src/routes/ai.js`: yeni `POST /api/ai/receipt-expense` — fotoğrafı Groq vision'a gönderir, firma adı + toplam tutarı JSON olarak döndürür (`GROQ_VISION_MODEL`, default `qwen/qwen3.8-27b`).
- Gider kategorilerine **"Ürün Alımı"** eklendi (DailyTab, VoiceEntry, ai.js sesli-giriş prompt'u — tutarlılık için üç yerde de).
- `client/src/ReceiptExpense.jsx`: fotoğraf çek/yükle → onay ekranında tutar+firma düzenlenebilir → onaylanınca `category: "Ürün Alımı"` ile günlük gidere kaydediliyor. DailyTab'da "Gider Ekle" bölümünün altına eklendi.
- **Dürüstlük testi geçti:** Gerçek dekont olmayan bir test görseli (düz mavi kare) gönderildiğinde model uydurma tutar üretmedi, "dekont/fiş bilgisi bulunmuyor" dedi — halüsinasyon riski düşük görünüyor, ama gerçek dekont fotoğraflarıyla kullanıcı test etmeli.
- Local'de tam test edildi (mekanik: upload→Groq→JSON→response; kayıt: "Ürün Alımı" kategorisiyle DB'ye doğru yazıldı — bu testte yine bash'e Türkçe karakter yazma hatası tekrar oldu, dosya üzerinden node script ile düzeltilip doğrulandı). Sonra canlıda (`hesapalr.vercel.app`) aynı endpoint test edildi, çalıştı.
- Commit edilip push edildi, Vercel otomatik deploy etti. `GROQ_VISION_MODEL` Vercel production'a da eklendi (kod zaten fallback default'la çalışıyordu, bu ekstra netlik için).

## Kredi Kartları Yeniden Tasarlandı — Banka+Sahip Bazlı Gruplama + Tam Veri Sıfırlama
- 2026-08-28: Kullanıcı isteği: aynı bankanın "Esnek Hesap" ve "Kredi Kartı" gibi kalemleri ayrı ayrı kart olarak değil, **banka altında tek grupta** gösterilsin (örn "Yapı Kredi" başlığı altında Esnek + Kredi Kartı satırları). Ayrıca: kartın son 4 hanesi girilsin, ödeme geçmişi ("şu kadar ödendi, şu gün") görünsün, kartlar **kişiye göre** (Tamer/Ramazan) gruplansın.
- **Netleştirme soruldu ve onaylandı:** (1) Tamer/Ramazan = sabit 2 kişilik sahip listesi (dükkanlar gibi), her kart birine ait. (2) "Tüm verileri sil" kapsamı — kullanıcı **HER ŞEYİ** (kredi kartları + tüm günlük/aylık gelir-gider geçmişi) silmek istediğini net onayladı, sadece kartları değil.
- **Veri sıfırlama (canlı Neon DB'de çalıştırıldı):** `TRUNCATE daily_income, daily_expense, monthly_expense, credit_card_debt_log, credit_cards RESTART IDENTITY CASCADE` — `shops` tablosuna (Hacıoğulları, Çıtır Tatlı) dokunulmadı, sadece işlem verileri silindi. Tek seferlik, kullanıcı onaylı, geri dönüşü yok — bundan sonra tüm gelir/gider/kart verisi sıfırdan giriliyor.
- **Şema değişikliği:** `credit_cards` tablosuna `owner` (Tamer/Ramazan), `type` (Kredi Kartı/Esnek Hesap/İhtiyaç Kredisi/Diğer), `last4` (kartın son 4 hanesi, opsiyonel) eklendi. `statement_day`/`due_day` artık **opsiyonel** (NOT NULL kaldırıldı) — Esnek Hesap gibi sabit ödeme tarihi olmayan ürünler için zorlama nominal gün girmeye gerek kalmadı. Canlı DB'de `ALTER TABLE` ile uygulandı, `schema.sql` da güncellendi (yeni kurulumlar için).
- **Backend (`creditCards.js`):** `nextOccurrence`/`daysUntil` artık `null` günü düzgün işliyor (statement/due günü yoksa `next_due_date`, `days_until_due` de `null`, `due_soon` her zaman `false` — çökme yok). Yeni `paymentHistory()` fonksiyonu: `credit_card_debt_log`'dan son 5 borç değişikliğini çekip, ardışık kayıtlar arası farkı (`delta`) hesaplıyor — pozitif delta = ödeme yapılmış, negatif/null = borç arttı/ilk kayıt. Her kartın API yanıtına `history` dizisi eklendi.
- **Frontend (`CreditCardsTab.jsx` baştan yazıldı):** Kart Ekle formuna "Kime ait" (Tamer/Ramazan) ve "Tür" (Kredi Kartı/Esnek Hesap/İhtiyaç Kredisi/Diğer, "Diğer" için serbest metin) seçicileri + "Kartın son 4 hanesi" alanı eklendi. Hesap kesim/son ödeme günü artık zorunlu değil. **Gruplama:** kartlar `name+owner` anahtarıyla client-side gruplanıyor — aynı banka+sahip'e ait tüm kalemler (Esnek, Kredi Kartı, vb) tek renkli kutu içinde alt alta gösteriliyor, her kalemin kendi borç/tarih/ödeme geçmişi/sil/güncelle aksiyonları var (`.debt-item` yarı saydam iç panel). Ödeme geçmişi: "Ödeme: 2.000 ₺ — 28 Ağustos 2026" veya "Borç artışı: X ₺ — tarih" şeklinde son 2 kayıt gösteriliyor.
- Local'de tam uçtan-uca test edildi: Kredi Kartı (son4 hane, kesim/son ödeme günü) + Esnek Hesap (günsüz, `due_soon:false`, çökmedi) + borç güncelleme sonrası ödeme geçmişi (`delta:2000`) doğru hesaplandı, aynı banka+sahip altında gruplandı. Test verileri temizlendi.
- Build temiz, commit+push edildi, Vercel otomatik deploy etti. Canlıda (`hesapalr.vercel.app`) doğrulandı: kart listesi boş (temiz sayfa), dükkanlar (`Hacıoğulları`, `Çıtır Tatlı`) hâlâ duruyor.
- **Kullanıcı için sıradaki adım:** Artık tüm gelir/gider/kredi kartı verisi sıfır — gerçek verileri yeni yapıya göre (banka, sahip, tür, son 4 hane) yeniden girmesi gerekiyor.
- 2026-08-29: Kullanıcı gerçek kartları girmeye başladı (canlıda doğrulandı): Ziraat Bankası, Yapı Kredi (Kredi Kartı + Esnek Hesap), Kuveyt Türk, Albaraka (İhtiyaç Kredisi), Garanti BBVA (2 kart) — hepsi "Tamer" altında. Sonraki çalışmalarda bu veriye hiç dokunulmadı, hepsi sağlam duruyor.

## Geriye Dönük Kayıt Kuralı Gevşetildi (24 Saat + Yönetici Şifresi) + Kart Ek Özellikleri
- 2026-08-29: Kullanıcı isteği: "sadece bugün" kuralı çok katıydı — **bugün ve dün** (24 saat içi) şifresiz serbest olsun, daha eskisi için **yönetici şifresi** ("Asi Zarok") istensin.
- `server/src/dateGuard.js`: `assertIsToday` → `assertDateAllowed(date, adminPassword)` oldu. Kural: gelecek tarih her zaman yasak (parola ile bile açılmıyor — mantıksız olurdu). Bugün/dün her zaman serbest. Daha eski tarih: `ADMIN_PASSWORD` env değişkeniyle `crypto.timingSafeEqual` karşılaştırması, tutmazsa 403. **Silme kuralı değişmedi** — yönetici şifresiyle eklenen geçmiş kayıt bile silinemiyor, sadece bugünün kaydı silinebiliyor (denetim ilkesi korundu).
- `dailyIncome.js`/`dailyExpense.js` POST+PUT route'ları yeni fonksiyona geçti, `admin_password` body alanını okuyorlar.
- `client/src/DailyTab.jsx`: tarih seçici geri geldi (`max=bugün`, geçmişe sınır yok). Seçilen tarih bugün/dün değilse kırmızı çerçeveli bir "Yönetici şifresi" kutusu beliriyor, formlar gönderirken `admin_password`'ü ekliyor. `VoiceEntry` ve `ReceiptExpense` bileşenlerine de `adminPassword` prop'u eklendi (sesle/foto ile geçmişe kayıt da aynı kurala tabi).
- Env: `ADMIN_PASSWORD=Asi Zarok` hem `server/.env` hem Vercel production'a eklendi.
- Local test: bugün şifresiz kabul (201), 3 gün önce şifresiz red (403), 3 gün önce yanlış şifre red (403), 3 gün önce doğru şifre kabul (201) — hepsi doğrulandı. Test satırları temizlendi (geçmiş tarihli olanlar API'den silinemediği için doğrudan DB'den temizlendi, kasıtlı).
- **Ek istekler aynı oturumda geldi, hepsi eklendi:**
  - **Kart ekran görüntüsünden borç okuma:** `POST /api/ai/card-balance` (Groq vision, aynı `qwen/qwen3.8-27b`) — banka uygulaması ekran görüntüsünden güncel borç/bakiye tutarını okuyor. `CreditCardsTab`'da her borç kaleminin yanına küçük 📷 butonu eklendi (`BalancePhoto` bileşeni) — fotoğraf yüklenince "Borcu Güncelle" tutar kutusunu otomatik dolduruyor, kullanıcı yine de "Borcu Güncelle"ye basarak onaylıyor (otomatik kaydetme yok).
  - **Kartta son 3 gün harcama gösterimi:** `creditCards.js`'e `recentCharges()` eklendi — o karta bağlı (`credit_card_id`), son 3 gün içindeki `daily_expense` kayıtlarını listeliyor. UI'da her kart kaleminin altında "[Banka] kartından X ₺ ödeme yapıldı — kategori — tarih" şeklinde gösteriliyor.
  - **Tedarikçi firma seçeneği:** Kart Ekle formuna bankaların yanına ikinci bir buton grubu eklendi: Lale Gıda, Örgün Gıda, Ambalaj, Coca-Cola, Alpedo (+ Diğer) — tedarikçiye olan borç da aynı ekrandan, aynı yapıda takip edilebiliyor. Tür listesine "Cari Hesap" eklendi (tedarikçi borçları için uygun terim).
- `ai.js` içinde tekrar eden Groq vision çağrı kodu `visionExtract()` ortak fonksiyonuna çıkarıldı (receipt-expense ve card-balance ikisi de kullanıyor).
- Uçtan uca test edildi (kart oluştur → gidere bağla → `recent_charges`'ta doğru göründü → vision endpoint gerçek görselle 200 döndü). Build temiz, commit+push, Vercel otomatik deploy etti. **Canlıda doğrulandı — kullanıcının önceden girdiği 7 gerçek kart hiç etkilenmedi, hepsi duruyor.**

## Tutar Düzenleme (Edit) + Tedarikçi Firma Butonları Görsel Düzeltmesi
- 2026-08-29: Kullanıcı: "fiyat eklerken hata yapıyorum, düzelt olsun" — 24 saat içi şifresiz, daha eski kayıt için zaten var olan yönetici şifresiyle düzenleme yapabilmek istedi.
- Backend'de `PUT /api/daily-income/:id` ve `PUT /api/daily-expense/:id` zaten `assertDateAllowed` kullanıyordu (bir önceki özellikte eklenmişti) — sadece **frontend edit arayüzü eksikti**, o eklendi.
- `client/src/api.js`: `dailyIncomeUpdate`, `dailyExpenseUpdate` (PUT wrapper) eklendi.
- `client/src/DailyTab.jsx`: yeni `AmountEditor` bileşeni — her gelir/gider satırında "Düzenle" linki, tıklayınca satır içi tutar kutusu + Kaydet/Vazgeç açılıyor. Kaydın tarihi bugün/dün değilse ek olarak yönetici şifresi kutusu da çıkıyor (`isYesterday` helper'ı eklendi). Düzenleme her zaman görünür (silme gibi sadece bugüne özel değil) — geçmiş kayıt şifreyle düzenlenebilir ama hâlâ silinemez (denetim ilkesi korunuyor, sadece "düzelt" izni var, "sil" izni yok).
- Test edildi: bugünkü kayıt şifresiz düzenlendi (100→250₺), doğrulandı. Commit+push, Vercel otomatik deploy etti.
- **Aynı oturumda ek istek:** Tedarikçi firma butonları (Lale Gıda, Örgün Gıda, Ambalaj, Coca-Cola, Alpedo) hepsi düz beyazdı, birbirinden ayırt edilemiyordu. Her firmaya sabit bir renk verildi (`SUPPLIER_COLORS`), banka butonlarıyla aynı aktif/pasif renklendirme mantığı uygulandı. Kart grubu başlığı da (firma seçilince) artık kendi renginde gösteriliyor (`getEntityColor` — önce firma rengine, yoksa banka rengine bakıyor). Buton şekli de "yatay sıralı, dikey kutucuk" istendiği gibi düzeltildi: sabit genişlikte (96px), ortalanmış, kare/dikdörtgene yakın kutucuklar — üstteki gibi ince yatay pilller değil, satıra sığmayanlar alt satıra kayıyor. Build temiz, commit+push, Vercel deploy etti.
- 2026-08-29: **Kullanıcı geri bildirimiyle üç küçük düzeltme daha:**
  1. Banka+Firma buton ızgarası (yukarıdaki renkli kutucuklar) kullanıcı isteğiyle **tek bir `<select>` dropdown'a** indirgendi (`<optgroup label="Banka">` / `<optgroup label="Firma">` ile ayrımı korunuyor) — "Kime ait" alanı gibi sade görünsün istendi. Eski `.bank-picker`/`.bank-option` CSS'i (artık kullanılmıyor) temizlendi.
  2. "Kartın son 4 hanesi" ve "Hesap kesim günü" alanları artık sadece **Kredi Kartı** ve **Diğer** türünde görünüyor — Esnek Hesap/İhtiyaç Kredisi/Cari Hesap'ta bu alanların hiç mantığı yok (kart numarası veya kesim döngüsü olmayan ürünler), gizlendi. Tür değiştirilince bu alanlardaki eski değerler de otomatik temizleniyor (yanlışlıkla eski son-4-hane başka türe sızmasın diye).
  3. "Ödeme Yapıldı" butonuna basınca artık `alert()` ile "X ₺ ödendi" popup'ı çıkıyor — önceden sessizce kaydediyordu, kullanıcı işlemin gerçekten kaydedildiğini görsel olarak teyit edemiyordu.
- Build temiz, commit+push, Vercel otomatik deploy etti, canlı doğrulandı (200 OK).

## Aylık Sekmede Kategori/Firma Bazlı Özet Raporu + Sabit Gider Sadece Hacıoğulları'nda
- 2026-08-29: Kullanıcı isteği: Sabit Gider Ekle formu sadece Hacıoğulları için anlamlı (Çıtır Tatlı'nın ayrı sabit gideri yok, sadece kendi gelir/gider toplamı gösterilsin). Ayrıca ay sonunda "Lale Gıda'ya şu kadar, aylık yemek gideri şu kadar" gibi kategorilere/firmalara ayrılmış bir özet rapor istendi (sabit giderler de bu raporun içinde).
- `server/src/routes/summary.js`: `/monthly` endpoint'i artık iki yeni alan döndürüyor: `expenseByCategory` (o ayın günlük giderleri `category` alanına göre gruplanıp toplanmış — Yemek, Temizlik, Ürün Alımı vb.) ve `expenseByVendor` (o ayın sabit giderleri `vendor_name`'e göre gruplanıp toplanmış — Lale Gıda, Elektrik vb., aynı firmaya birden fazla kayıt varsa toplanıyor).
- `client/src/MonthlyTab.jsx`: "Sabit Gider Ekle" bölümü artık `shops` listesinden seçili dükkanın adı "Hacıoğulları" olduğunda gösteriliyor (`shopName === 'Hacıoğulları'`), Çıtır Tatlı seçiliyken gizli — sadece üstteki gelir/gider özeti görünür kalıyor. Yeni "Özet Raporu Göster/Gizle" butonu ile açılıp kapanan bir bölüm eklendi: kategori bazlı günlük gider toplamları + (sadece Hacıoğulları'nda) firma bazlı sabit gider toplamları, `formatMoney` ile "X bin ₺" formatında.
- Gerçek kullanıcı verisiyle test edildi: Hacıoğulları Ağustos ayı — Ürün Alımı 27.500₺, Yemek 700₺ doğru ayrıştı.
- Build temiz, commit+push edildi, Vercel otomatik deploy etti, canlı doğrulandı.

## Proje Yapısı
```
hesapalr/
  server/            Express API
    src/
      index.js        giriş noktası
      db.js            pg pool
      migrate.js       schema.sql'i DB'ye uygular
      routes/          shops, dailyIncome, dailyExpense, monthlyIncome, monthlyExpense, summary
    schema.sql
    .env.example       DATABASE_URL, PORT
  client/            React (Vite) arayüz
    src/
      App.jsx          sekme yönlendirme (Günlük/Aylık)
      DailyTab.jsx      nakit gelir + günlük gider giriş/liste
      MonthlyTab.jsx    POS gelir + sabit gider giriş/liste
      api.js            backend fetch helper'ları
```

## PWA (Ana Ekrana Ekleme)
- `client/public/manifest.webmanifest` — isim, tema rengi, ikonlar
- `client/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — düz mavi placeholder ikon (gerçek logo gelince değişecek)
- `client/public/sw.js` — basit service worker, sadece `/` route'unu önbelleğe alır (`/api/*` hariç). Tam offline için build sonrası hash'li dosyaları da önbelleğe alacak `vite-plugin-pwa` eklenebilir — backlog'a not düşüldü.
- `index.html`'e manifest link, apple meta tag, theme-color eklendi
- **Not:** Service worker + install prompt için HTTPS gerekli (localhost hariç). Deploy sonrası (Vercel/Netlify vb) otomatik https ile "Ana Ekrana Ekle" telefonda çıkar.

## Sesli AI Giriş (Groq)
- `server/src/routes/ai.js` — `POST /api/ai/voice-entry` (ses → Whisper → LLM → işlem taslağı, nakit/pos/gider ayrımı dahil)
- Gerekli: `server/.env` içine `GROQ_API_KEY=...` (https://console.groq.com üzerinden alınır)
- Model isimleri `.env`'de override edilebilir (`GROQ_WHISPER_MODEL`, `GROQ_TEXT_MODEL`) — Groq model kataloğu zaman zaman değişiyor, default çalışmazsa güncel model adıyla değiştir.
- **Not:** Mikrofon erişimi (`getUserMedia`) tarayıcıda sadece HTTPS veya `localhost`'ta çalışır. Telefonda test için deploy sonrası https gerekir (bkz. PWA notu).
- Hiçbir ses kaydı otomatik DB'ye yazılmıyor — önce onay ekranında gösterilip düzenlenebiliyor, kullanıcı "Onayla ve Kaydet" demeden kaydedilmiyor.
- Foto/OCR (fiş tarama) özelliği kullanıcı isteğiyle kaldırıldı — POS de sesle girilir.

## Kurulum / Çalıştırma (Sıradaki Adım — Kullanıcı İçin)
1. **Neon hesabı aç:** https://neon.tech → ücretsiz kayıt ol.
2. Yeni proje oluştur, bağlantı dizesini (connection string) kopyala.
3. **Groq hesabı aç:** https://console.groq.com → ücretsiz API key al.
4. `server/.env.example` dosyasını `server/.env` olarak kopyala, `DATABASE_URL` ve `GROQ_API_KEY` değerlerini doldur.
5. `cd server && npm run migrate` — tabloları oluşturur, 2 dükkanı ekler.
6. `cd server && npm run dev` — API `http://localhost:4000` üzerinde çalışır.
7. `cd client && npm run dev` — arayüz `http://localhost:5173` üzerinde çalışır (API'ye otomatik proxy var).

Neon/Groq olmadan hızlı görsel test için: `cd server && npm run preview` (bellek-içi sahte DB, GROQ_API_KEY yoksa ses/foto özellikleri 400 hatası verir ama gerisi çalışır).
