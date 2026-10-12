# BioBug — demo ve jüri hazırlığı

Katılımcı rehberi: 12 Ekim 2026, DotsHub. Ön tur 2 dakika demo + 1 dakika soru; final 3 dakika demo + 1 dakika soru. Beş eşit ağırlıklı ölçüt: problem/değer, uygulama, Codex/araç kullanımı, etki/potansiyel, sunum. Sıralama garanti edilemez. Üçüncülük hedefi için kapsamı tamamlanmış, ölçümleri savunulabilir ve internet kesilse de çalışan bir demo hazırlıyoruz.

## İki dakikalık anlatım

**0:00–0:20 · Problem, ana sayfa.**

“Enkazdaki erişilemeyen alanlar, kurtarma ekibi için bir bilgi problemi. BioBug, küçük otonom keşif araçlarının birlikte nasıl harita çıkarabileceğini araştıran çalışan bir yazılım platformu. Burada bir fiziksel kurtarma cihazı sergilemiyorum; böyle bir sistemin kararlarını ölçülebilir hale getiriyorum.”

**0:20–0:45 · Çalışan görev.**

Rescue → DEPLOY SWARM. Haritanın gözlemle açılmasını göster. Bir böcek seç; rotayı ve keşif kaydını göster.

“Dört keşifçi bir haritayı paylaşıyor. Bilinmeyen hedefler algılanmadan görüntülenmiyor. Ekrandaki sinyaller simülasyon; ‘confirmed’ gerçek insan doğrulaması anlamına gelmiyor.”

**0:45–1:20 · Deney.**

Research & evidence → varsayılan residential / 2026 / 60 s / 4 agents → Run comparison. Deney birkaç saniyede hesaplanır; iki haritayı, sonra replay kaydırıcısını göster.

“Aynı arazi, aynı sensör ve aynı hareket motoruyla iki karar yöntemini karşılaştırıyorum. Birisi en yakın keşif sınırına gidiyor. Eklediğimiz yöntem, alınacak yeni bilgiyi yol maliyetiyle birlikte değerlendiriyor ve takım arkadaşlarının aynı alanı tekrar hedeflemesini azaltıyor.”

**1:20–1:45 · Kanıt.**

The recorded study bölümüne git. Toplam satırını, ardından dar koridor satırını göster.

“Üç ortam ve beş sabit tohumda toplam 30 koşu yaptık. 60 saniyelik kapsama yüzde 66,99'dan 74,07'ye çıktı: 7,08 yüzde puan. Dar koridorlarda iki yöntem de görevi tamamlayamadı. Bu sınırı da kayda aldık. Sonuçlar, kaynak kodu parmak izleri ve tekrar üretme komutu indirilebilir.”

**1:45–2:00 · Araç kullanımı ve sonraki adım.**

“Codex ile arXiv ve PubMed kaynaklarını araştırdık; planlayıcıyı, deney altyapısını, testleri ve bu yeni arayüzü geliştirdik. Sonraki doğrulama, önceden sabitlenmiş yeni haritalarda konum ve iletişim hataları eklemek. Bugünkü teslimimiz, iddiasını tekrar çalıştırabileceğiniz bir araştırma prototipi.”

## Üç dakikalık final için ek dakika

Virtual lab → uygun sekmede nöron yapısını göster. Backend hazır değilse Rule-Based'te kal ve yapıyla aktiviteyi ayır.

“Önceden var olan MaleCNS entegrasyonu gerçek yapısal bağlantı verisi kullanıyor; aktivite ve motor eşlemesi mühendislik modeli. Yeni karşılaştırma bu nöral denetleyiciyi test etmiyor, iki kolda da aynı kural tabanlı hareket var. Böylece harita planlamasının katkısını izole ediyoruz.”

Bir bibliyografya kaydının Implementation & limitations ayrıntısını aç; ardından CSV/replay dışa aktarımını göster. Deney için tarayıcıda API anahtarı veya Python sunucusu gerekmediğini söyle.

## Muhtemel sorulara kısa cevaplar

| Soru | Cevap |
| --- | --- |
| Gerçek böcek var mı? | Hayır. PubMed'deki donanım çalışmaları dış kaynak; biz yazılım prototipiyiz. |
| Bu yöntem her zaman daha mı iyi? | Hayır. Kayıtlı 60 saniyelik 15 eşleşmede daha iyi kapsama gördük. Örneğin aynı residential/2026 deneyini 120 saniyeye uzattığımız tarayıcı kontrolünde bilgi yöntemi 3,95 puan geride kaldı. Süreye ve ortama bağlılık sonraki deneylerin konusu. |
| Yüzde 7 daha mı iyi? | 7,08 **yüzde puan**. İki kapsama oranının farkı; gerçek kurtarma başarı oranı değil. |
| Akademik katkınız ne? | Literatürden esinlenen, açıkça tanımlı bağımsız sezgisel yöntem; eşleşmiş deney altyapısı ve tekrar üretilebilir kanıt. Yeni SOTA veya makale algoritmasının birebir tekrarı iddiası yok. |
| Neden sadece beş tohum? | Hackathon için sınırlı ve açıkça keşifsel bir çalışma. Güven aralığı saha güvenilirliği anlamına gelmez. Daha büyük, ayrı doğrulama kümesi gerekli. |
| Gizli hedefleri biliyor mu? | Planlama politikası gözlenen haritayı alır. Hedef bilgisi ve erişilebilirlik paydası politika girdisi değildir. Senaryo üretimi ve skor hesabı dünya bilgisi kullanır. |
| İnternet kesilirse? | Simülasyon ve deney tarayıcıda çalışır. MaleCNS ve AI isteğe bağlıdır. Kayıtlı sonuçlar uygulamayla birlikte gelir. |
| Codex ne yaptı, insan ne yaptı? | Codex'in yaptığı kod, araştırma, test ve tasarımı bu oturumun Git diff'i ile gösterebiliriz. Problem seçimi, ürün yönlendirmesi ve sunum sahibi kullanıcıdır. Önceki özellikleri bugün yapılmış gibi anlatmayız. |

## Bu oturumdaki işin sınırı

Başlangıç commit'i: `d841b869aa48ad07ac40af51affc71530554b896`.

Önceden vardı: kurtarma simülasyonu, koordinasyon, MaleCNS yapısal veri ve denetleyici entegrasyonu, 3D görünüm, termal görev, AI Commander ve önceki ölçüm raporları.

Bu oturumda eklendi/değişti: bilgiye göre frontier seçimi; üç üretilen ortam; 30 koşuluk eşleşmiş benchmark; bootstrap belirsizlik aralıkları; worker tabanlı deney, replay ve dışa aktarım; beş kaynaklı kanıt kaydı; bütün ana ekranlarda beyaz akademik tasarım; ölçülmüş rotalardan mimari atlas; araştırma regresyon testleri; Python bağımlılık kilidinin temiz ortamla doğrulanması; CI doğrulaması; bu sunum dosyası.

Son kontrol: [VALIDATION.md](VALIDATION.md). Anlatırken yeni benchmark ile önceki MaleCNS karşılaştırmasını aynı deney gibi sunma.

## Demo provası ve kurtarma yolu

1. `npm ci && npm run dev` ile yerel kopyayı aç. Başka uygulamalardan gelen bildirimleri kullanıcı kendi tercihine göre kapatabilir.
2. Ana sayfa, Rescue ve Research rotalarını aç; benchmark dosyalarının geldiğini kontrol et.
3. 60 saniyelik varsayılan deneyi bir kez çalıştır; replay ve CSV'yi hazır tut. Sahnedeki hareketin fiziksel zamandan hızlı hesaplandığını “simulated seconds” olarak anlat.
4. WebGL sorununda 2D haritayı kullan. Backend yoksa Rule-Based ile devam et. AI bağlantısı demo için gerekli değil.
5. Araştırma worker'ı çalışmazsa kayıtlı 30 koşuyu göster ve canlı hesaplamanın çalışmadığını açıkça söyle. Önceden kayıtlı sonucu canlıymış gibi sunma.
6. Ön turu 1:50'de bitirecek şekilde prova et; kalan 10 saniye ekran geçişleri için paydır.
