import type { Locale } from './locale'

/**
 * UI copy for both shipped languages.
 *
 * Long-form legal text deliberately does NOT live here — see
 * src/content/legal/. Shipping an unreviewed Turkish translation of a privacy
 * policy is worse than shipping an English one with a clear notice, so those
 * documents stay in one language until a lawyer signs off on the second.
 */
const en = {
  nav: {
    species: 'Species',
    lab: 'Lab',
    howItWorks: 'How it works',
    support: 'Support',
    install: 'Get the app',
    skipToContent: 'Skip to content',
    menu: 'Menu',
  },

  // The Lab: one write-up per experiment. Copy only — every number on a Lab
  // page (correlations, counts, the checkpoint, the pitch formula) is rendered
  // from src/data/lab/*.json, never typed here.
  lab: {
    title: 'Lab',
    lede: 'Notes from building the voices — one write-up per experiment, with the data you can play.',
    eyebrow: 'Lab note',
    backToLab: 'All lab notes',
    speciesLabel: 'Species',
    dateLabel: 'Published',
    open: 'Read',
    // The index's second way into an entry. {n} is the clip count, from the
    // generated data — never a number typed here.
    wildLink: '{n} real bird voices',
    entries: {
      'wren-voice-space': {
        title: 'Wren voice space',
        summary:
          'The 31 letter motifs of the first voice we trained, plotted on how fast each note sweeps, how long it lasts and the pitch it was assigned — and lit up as a message is sung.',
      },
      'sparrow-voice-space': {
        title: 'Sparrow voice space',
        summary:
          'The song sparrow’s 31 letter motifs on the same three axes. Of the three trained voices, this is the one whose axes lean on each other least.',
      },
      'cardinal-voice-space': {
        title: 'Cardinal voice space',
        summary:
          'The cardinal sings its letters on the narrowest ladder of the three — 65 Hz apart instead of 120 — so its spine is short and its notes crowd together.',
      },
    },
    voiceSpace: {
      lede: 'Press play. Each letter lights up in the space as it is sung, and the line behind it is the path the message has taken so far. Click any point to jump to that letter.',
      chooseMessage: 'Message',
      dragHint: 'Drag to rotate',
      resetView: 'Reset view',
      // {species} is filled in by views/LabEntry.tsx. The plot is the same
      // measurement for every bird, so none of this copy names one.
      stageLabel:
        '{species} — three-dimensional scatter of 31 letter motifs by sweep slope, duration and pitch',
      pointLabelPrefix: 'Letter',
      spaceGlyph: 'space',
      notInMessage: 'This letter is not in the current message.',
      axes: {
        slope: 'falling ← → rising',
        slopeUnit: 'sweep slope, Hz/s',
        duration: 'short → long',
        durationUnit: 'duration, ms',
        pitch: 'low → high',
        pitchUnit: 'pitch, Hz',
        colour: 'colour: brightness, dull → bright',
        size: 'size: sweep span',
      },
      views: {
        groupLabel: 'Square up on one axis',
        slope: 'Slope',
        duration: 'Duration',
        pitch: 'Pitch',
        slopeTitle: 'Turn until the sweep-slope axis points at you: pitch against duration',
        durationTitle: 'Turn until the duration axis points at you: sweep slope against pitch',
        pitchTitle: 'Look straight down: sweep slope against duration',
      },
      readout: {
        idle: 'Letter',
        singing: 'Now singing',
        selected: 'Selected',
        silence: 'Between notes',
        empty: 'Press play, or pick a point.',
        contour: 'Pitch contour',
        loudness: 'Loudness',
        pitch: 'Pitch',
        duration: 'Duration',
        slope: 'Sweep slope',
        span: 'Sweep span',
        brightness: 'Brightness',
        breathiness: 'Breathiness',
        transplant: 'Transplant distance',
        motif: 'Motif',
        of: 'of',
      },
      method: {
        title: 'Why these three axes',
        body: 'Five things were measured per note. Brightness rises almost exactly with pitch in every voice we have trained — these birds sing tonally, so the spectral centroid simply tracks the fundamental — and plotting both would draw one fact twice. Brightness is shown as colour instead, and sweep span became point size. What the remaining three do to each other is each bird’s own business, and the table is the measurement rather than a claim: where a pair leans, square up on the third axis and the lean is there to see.',
        pairHeading: 'Pair',
        rHeading: 'correlation r',
        pairs: {
          pitchBright: 'pitch ↔ brightness',
          pitchDur: 'pitch ↔ duration',
          pitchSlope: 'pitch ↔ sweep slope',
          durSlope: 'duration ↔ sweep slope',
        },
        demoted: 'demoted to colour',
      },
      provenance: {
        title: 'Where the points come from',
        checkpoint: 'Checkpoint',
        recordings: 'Recordings',
        clips: 'clips',
        notes: 'Usable notes',
        assignment: 'Assignment',
        assignmentBody:
          'Each letter claims one real note, chosen with a fixed seed from the notes sung nearest its pitch, and no two letters share one. The note is rendered by the same model that sings the messages, and every number here was measured from that rendering.',
        generated: 'Measured',
      },
      reading: {
        title: 'Reading the plot',
        spine: 'Pitch is not measured; it is assigned. Every letter sits at exactly',
        spineAfter:
          'so a→z climbs the vertical axis as a straight spine. That spine is the protocol — the same frequency-shift keying the parametric voices use, now sung by a model.',
        scatter:
          'Everything the points do left-to-right and front-to-back is the bird: how fast each note sweeps and how long it lasts were borrowed from real recordings of the {species}, not designed.',
      },
    },

    // The counterweight to the voice space: the same decoder, pointed at the
    // real bird. Every number and every letter comes from the generated file;
    // this copy only frames them, so none of it may state a result.
    wildVoices: {
      title: 'Real bird voices',
      lede: 'Everything else on this page is our audio. These five are the {species} itself, from the same archive the model was trained on — and beside each one is what our decoder reads out of it, run on the very file you are playing.',
      body: 'The decoder is closed-set: it has thirty-one letters and no way to answer “none of these”, so it always returns its best explanation. Pointed at a wild recording it returns letters, confidently, and they mean nothing. What tells the difference is not the text but the score underneath it — how well one whole sequence of our motifs, at our durations, with our gaps, explains the entire clip. A real bird sings notes like ours; it does not lay them out like ours.',
      clipLabel: 'Field recording',
      readsAs: 'Our decoder reads',
      readsNothing: 'nothing at all',
      scoreLabel: 'Score',
      thresholdLabel: 'believed above',
      messageScoreLabel: 'our own message',
      verdict: 'Below the threshold: not read as a message.',
      statsTitle: 'Which five, and why these five',
      licensable: 'Licensed to show',
      licensableOf: 'of {total} corpus clips',
      recordings: 'Distinct recordings',
      recordingsNote:
        'Only clips under CC BY-SA can be published here; the rest of the corpus is non-commercial. Where that leaves a single recording, the five clips are five passages of one bird.',
      decoderLabel: 'Decoder',
      checkpointLabel: 'Checkpoint',
    },
  },

  hero: {
    oneLiner: 'your voice, in birdsong.',
    sub: 'Speak a message. It arrives as a bird — and it arrives readable. The birds you find in the real world become the voices you can speak in.',
    demoTitle: 'Hear it now',
    demoHint: 'Nothing to install. Nothing to sign up for.',
  },

  // The interactive encoder. `button` is the same English word in both
  // locales on purpose: it labels the one control that performs the
  // product's defining verb, and keeping it identical keeps screenshots,
  // support answers and the spec talking about the same button.
  encoder: {
    title: 'Now yours',
    hint: 'Up to 80 characters. a–z, spaces and . , ? ’ are sung; anything else becomes a pause.',
    placeholderStatic: 'Type a message…',
    button: 'Encode',
    encoding: 'Encoding…',
    error: 'That did not encode. Try again.',
    unavailable: 'Live encoding runs from a local checkout — it needs the models and the recording corpus, which are not deployed. The clips above are the same engine, rendered ahead of time.',
    resultLabel: 'Your message',
    voiceLabel: 'Voice',
    trainedOnLabel: 'Trained on',
    clips: '{n} clips',
  },

  demo: {
    sourceLabel: 'The spoken sentence',
    sourceCaption: 'A person says:',
    encodedLabel: 'The same sentence, in birdsong',
    pick: 'Choose a voice',
    decodedAs: 'Decoded on arrival as',
    play: 'Play',
    pause: 'Pause',
    replay: 'Replay',
    transcriptNote:
      'Every message shows its text. The audio is the experience; the text is the guarantee.',
    tierLabel: 'Tier',
    accuracyLabel: 'Decode accuracy',
    accuracyNote:
      'Measured by decoding this exact file back to text with the same engine that made it.',
    accuracyNoteNeural:
      'Measured by decoding this exact file back to text. This voice is a trained model singing real, unequal notes rather than fixed tones on a grid, so it is read back by a motif search rather than an FFT.',
    neuralTag: 'trained model',
    alphabetNote: '',
  },

  install: {
    ios: 'Download on the App Store',
    android: 'Get it on Google Play',
    soonIos: 'App Store — coming soon',
    soonAndroid: 'Google Play — coming soon',
    unavailableNote: 'CICI BIRD has not launched yet. No store listing is live.',
  },

  how: {
    title: 'How it works',
    lede: 'Three steps, and the third is the one that matters.',
    steps: [
      {
        title: 'Speak',
        body: 'Hold the record button and say what you mean. You see the transcript and hear the result before anything sends — a speech-to-text slip never becomes a wrong message.',
      },
      {
        title: 'It becomes birdsong',
        body: 'Your words are encoded into a motif sequence and sung in the species you picked. Not a filter over your voice — a real symbol alphabet, built from how that bird actually sings.',
      },
      {
        title: 'They hear it, and read it',
        body: 'The recipient gets birdsong with the decoded text running underneath it, subtitle-style. Muted, on a bus, in a meeting: still perfectly readable.',
      },
    ],
  },

  collect: {
    eyebrow: 'The differentiator',
    title: 'The voices are found, not bought',
    lede: 'This is the part that makes it more than a novelty. You can pay for a bird. Or you can go outside and find one.',
    body: 'Hear a bird you do not recognise. Open CICI BIRD, hold up your phone, and record it. The app identifies the species against a bioacoustic model, checks that the bird is plausible where and when you are standing, and if it holds up, that voice is added to your library. You can now speak in it.',
    points: [
      {
        title: 'Recording, not screenshotting',
        body: 'Unlocks come from a real recording made in a real place. A file someone sent you will not pass.',
      },
      {
        title: 'Location is a single snapshot',
        body: 'Checked once, at the moment you record, to confirm the species is plausible there. Not tracking. Deny it and identification still works — only the free unlock is unavailable.',
      },
      {
        title: 'Season and place decide what you can find',
        body: 'Swallows are in Türkiye from March to October and nowhere in January. A nightingale sings in late spring. The catalog moves with the year because the birds do.',
      },
      {
        title: 'A bad recording is not an accusation',
        body: 'Verification is graded, not pass/fail. A weak result gets you a partial unlock or a review, not a rejection notice implying you cheated.',
      },
    ],
    tiersTitle: 'What a find is worth',
    tiers: {
      starter: 'Starter species are free from the start — sparrow, pigeon, crow.',
      basic: 'Basic species unlock free when you find and verify them, or cost a small purchase if you would rather not wait for the season.',
      premium: 'Premium species give a discount for a verified find rather than a free unlock. A bird this wanted would otherwise empty the catalog.',
    },
  },

  preview: {
    title: 'The launch catalog',
    lede: 'Eight species at launch. Three you already have, three you can find, two that take more than luck.',
    cta: 'Browse all species',
    play: 'Play sample',
  },

  credibility: {
    title: 'Built on real bioacoustics',
    body: 'Species identification runs on an established bird sound classification model — BirdNET is the reference architecture — with location and time of year as inputs, which is what makes the plausibility check meaningful rather than decorative.',
    honestTitle: 'What we will not claim',
    honest: 'The encoder does not transform your voice into a real bird. It encodes text into a designed symbol alphabet rendered in each species’ acoustic range and phrasing. That is why it decodes reliably, and we would rather say so than imply magic.',
    attributionTitle: 'Attribution',
    attributionNote:
      'Audio and imagery credits on every species page are rendered from each asset’s own metadata, not typed in by hand. Where provenance is still being confirmed, the page says so instead of printing an attribution we cannot stand behind.',
    modelNote:
      'BirdNET model weights carry licence terms that differ by release. Commercial use requires the appropriately licensed model and written confirmation, which is a launch prerequisite, not an afterthought.',
  },

  finalCta: {
    title: 'Go and find a bird.',
    body: 'Then tell someone about it, in its voice.',
  },

  message: {
    badge: 'A birdsong message',
    sentIn: 'Sent in the voice of',
    playPrompt: 'Play message',
    transcript: 'Transcript',
    liveSubtitle: 'Decoded subtitle',
    subtitleHint: 'The text appears in time with the song. Readable with sound off.',
    replyTitle: 'Reply in birdsong',
    replyBody:
      'Get CICI BIRD to answer this in a voice of your own — and to find the birds that unlock new ones.',
    aboutSpecies: 'About this species',
    expiredTitle: 'This link has expired',
    expiredBody:
      'Shared birdsong links stop working after 30 days by default. The message itself is not gone — it is still in the sender’s conversation. Ask them to share it again.',
    revokedTitle: 'This link was turned off',
    revokedBody:
      'The sender revoked this link. Sharing outside the app is opt-in per message and can be undone at any time, so a link that once worked can stop working on purpose.',
    missingTitle: 'Nothing here',
    missingBody:
      'This link does not point to a message. Shared links are long and random by design, so a single wrong character lands exactly here.',
    privacyNote:
      'Messages are private by default. This one was shared deliberately. The recipient is never named on this page.',
    demoNotice:
      'Demonstration message. The messaging backend is not connected to this site yet — these are fixtures that exercise every state the real page will have.',
    expiresIn: 'Link expires',
    sharedOn: 'Shared',
  },

  catalog: {
    title: 'Species',
    lede: 'Every voice in CICI BIRD, where to find it, and what it costs if you cannot.',
    filterTier: 'Tier',
    filterRegion: 'Region',
    filterSeason: 'Season',
    filterAll: 'All',
    reset: 'Clear filters',
    resultsOne: 'species',
    resultsMany: 'species',
    empty: 'No species match those filters.',
    findable: 'Findable in the wild',
    purchaseOnly: 'Purchase only',
    listen: 'Listen',
    open: 'Open species page',
    showing: 'Showing',
    of: 'of',
    soon: 'Soon',
    soonNote:
      'No trained voice yet. This bird sings a placeholder, so its page stays closed until the model is real.',
  },

  species: {
    scientificName: 'Scientific name',
    alsoKnown: 'Turkish name',
    alsoKnownEn: 'English name',
    realCall: 'The real call',
    encodedSample: 'A message in this voice',
    encodedSampleNote: 'Encoded with the same engine the app uses.',
    score: {
      caption: 'Every note at its pitch · swipe',
      stageLabel:
        'The message below, drawn as a score: every note {species} sings, at the time and the pitch it is sung. It lights up as the clip plays.',
    },
    whereWhen: 'Where and when',
    regions: 'Range',
    seasons: 'Season',
    habitat: 'Habitat',
    unlockTitle: 'Tier and unlock',
    voiceTitle: 'What this voice sounds like',
    creditsTitle: 'Credits and licensing',
    creditsNote: 'Rendered from each asset’s metadata.',
    pendingVerification: 'Provenance pending verification',
    backToCatalog: 'All species',
    synthesized: 'Synthesized reference',
    fieldRecording: 'Field recording',
    creditSource: 'Source',
    creditRecordist: 'Recordist',
    creditLicence: 'Licence',
    duration: 'Duration',
    tierNames: {
      starter: 'Starter',
      basic: 'Basic',
      premium: 'Premium',
    },
    model: {
      badge: 'Trained voice',
      title: 'This voice is a trained model',
      body: 'Most of the launch catalog is rendered by a hand-authored synthesis profile. This species is not. It has a DDSP model fitted to real recordings of the bird, and its messages are sung with note motifs borrowed from those same recordings — so what you hear is the model’s output, not an approximation of it.',
      modelLabel: 'Model',
      corpusLabel: 'Trained on',
      corpusUnit: 'clips',
      decoderLabel: 'Decoder',
      accuracyLabel: 'Decoded back at',
      accuracyBody: 'Measured by running this exact clip back through the decoder — a motif search over the model’s own note templates, not the fixed-grid FFT the parametric voices use. The floor for shipping is 90%.',
      accuracyImperfect: 'It reads back under 100% because a trained voice sings real, unequal notes instead of fixed tones on a grid. That is the trade the model exists to make, and here is exactly what it cost:',
      forkTitle: 'A real bird is not a message',
      forkBody: 'The decoder always returns its best reading, so something has to decide whether there is a message there at all. Scored on the clips this page plays:',
      forkMessage: 'This message',
      forkWild: 'A wild recording of the same species',
      forkThreshold: 'Believe-it threshold',
      forkPassed: 'Separated cleanly.',
    },
    unlockPaths: {
      free: 'Free from the start.',
      'field-or-purchase':
        'Free when you find and verify it in the wild, or a small purchase.',
      'field-discount-or-purchase':
        'A verified find takes 50% off. Otherwise, full purchase.',
      'purchase-only': 'Purchase only in this release.',
    },
  },

  regions: {
    europe: 'Europe',
    turkiye: 'Türkiye',
    'north-america': 'North America',
    'north-africa': 'North Africa',
    'central-asia': 'Central Asia',
  },

  seasons: {
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    winter: 'Winter',
    yearRound: 'Year-round',
  },

  legal: {
    reviewBanner: 'TODO: legal review required before launch',
    reviewBannerBody:
      'This document is drafted from a template and describes intended practice. It has not been reviewed by a lawyer and must not be relied on as it stands.',
    trTranslationBanner:
      'Bu belgenin Türkçe çevirisi, Türkiye lansmanından önce hukuki inceleme ile birlikte yayımlanacaktır. Aşağıdaki İngilizce metin şu an için geçerli sürümdür.',
    lastUpdated: 'Last updated',
    contact: 'Questions about this document',
  },

  support: {
    title: 'Support',
    lede: 'The questions the app is going to generate, answered before you have to ask.',
    contactTitle: 'Still stuck',
    contactBody: 'Write to us and describe what happened. Include your device and the approximate time — it makes a real difference to how fast we can find the problem.',
  },

  dataRequest: {
    title: 'Access or delete your data',
    lede: 'A route that actually goes somewhere. Under KVKK and GDPR you can ask what we hold about you and ask us to delete it.',
  },

  consent: {
    title: 'Cookies and measurement',
    body: 'We measure how many people play a demo and follow a link. It is aggregate and non-identifying, and nothing is stored on your device until you accept.',
    accept: 'Accept',
    decline: 'Decline',
    more: 'Read the privacy policy',
    declinedNote: 'Declined. Nothing is being measured.',
  },

  soon: {
    title: 'Not yet',
    body: 'This page is planned but not built. It is not part of the launch.',
    back: 'Back to the home page',
  },

  notFound: {
    title: 'This page does not exist',
    body: 'The link may be wrong, or the page may have moved.',
    home: 'Home',
    species: 'Species catalog',
  },

  footer: {
    product: 'Product',
    legal: 'Legal',
    company: 'Company',
    house: 'CICI BIRD is a CICI project.',
    sibling: 'Also from CICI',
    rights: 'All rights reserved.',
    language: 'Language',
  },
}

/** Turkish. Same shape, checked structurally by the `Dictionary` type below. */
const tr: Dictionary = {
  nav: {
    species: 'Türler',
    lab: 'Lab',
    howItWorks: 'Nasıl çalışır',
    support: 'Destek',
    install: 'Uygulamayı al',
    skipToContent: 'İçeriğe geç',
    menu: 'Menü',
  },

  // DRAFT TRANSLATION — written alongside the English, not by a native
  // reviewer. Needs a read-through before a Türkiye launch, especially the
  // technical terms (kayma eğimi, parlaklık, nefeslilik).
  lab: {
    title: 'Lab',
    lede: 'Sesleri yaparken tuttuğumuz notlar — her deney için bir yazı, oynatabileceğiniz verilerle.',
    eyebrow: 'Lab notu',
    backToLab: 'Tüm lab notları',
    speciesLabel: 'Tür',
    dateLabel: 'Yayın',
    open: 'Oku',
    wildLink: '{n} gerçek kuş sesi',
    entries: {
      'wren-voice-space': {
        title: 'Çıtkuşunun ses uzayı',
        summary:
          'Eğittiğimiz ilk sesin 31 harf motifi; her notanın ne kadar hızlı kaydığı, ne kadar sürdüğü ve hangi perdeye atandığı üzerinde çizildi — ve bir mesaj söylenirken tek tek yanıyor.',
      },
      'sparrow-voice-space': {
        title: 'Serçenin ses uzayı',
        summary:
          'Ötücü serçenin 31 harf motifi, aynı üç eksende. Eğitilmiş üç ses içinde eksenleri birbirine en az yaslanan bu.',
      },
      'cardinal-voice-space': {
        title: 'Kardinalin ses uzayı',
        summary:
          'Kardinal harflerini üçünün en dar merdiveninde söylüyor — 120 Hz değil, 65 Hz aralıkla — bu yüzden omurgası kısa, notaları birbirine yakın.',
      },
    },
    voiceSpace: {
      lede: 'Oynat’a basın. Her harf söylenirken uzayda yanar; arkasındaki çizgi mesajın o ana kadar izlediği yoldur. Bir noktaya tıklayınca o harfe atlar.',
      chooseMessage: 'Mesaj',
      dragHint: 'Döndürmek için sürükleyin',
      resetView: 'Görünümü sıfırla',
      stageLabel:
        '{species} — 31 harf motifinin kayma eğimi, süre ve perdeye göre üç boyutlu dağılımı',
      pointLabelPrefix: 'Harf',
      spaceGlyph: 'boşluk',
      notInMessage: 'Bu harf şu anki mesajda yok.',
      axes: {
        slope: 'düşen ← → yükselen',
        slopeUnit: 'kayma eğimi, Hz/s',
        duration: 'kısa → uzun',
        durationUnit: 'süre, ms',
        pitch: 'pes → tiz',
        pitchUnit: 'perde, Hz',
        colour: 'renk: parlaklık, mat → parlak',
        size: 'boyut: kayma genişliği',
      },
      views: {
        groupLabel: 'Bir eksene dik bak',
        slope: 'Eğim',
        duration: 'Süre',
        pitch: 'Perde',
        slopeTitle: 'Kayma eğimi ekseni size bakana dek döndür: süreye karşı perde',
        durationTitle: 'Süre ekseni size bakana dek döndür: perdeye karşı kayma eğimi',
        pitchTitle: 'Tam yukarıdan bak: süreye karşı kayma eğimi',
      },
      readout: {
        idle: 'Harf',
        singing: 'Şu an söylenen',
        selected: 'Seçili',
        silence: 'Notalar arası',
        empty: 'Oynat’a basın ya da bir nokta seçin.',
        contour: 'Perde eğrisi',
        loudness: 'Gürlük',
        pitch: 'Perde',
        duration: 'Süre',
        slope: 'Kayma eğimi',
        span: 'Kayma genişliği',
        brightness: 'Parlaklık',
        breathiness: 'Nefeslilik',
        transplant: 'Taşıma mesafesi',
        motif: 'Motif',
        of: '/',
      },
      method: {
        title: 'Neden bu üç eksen',
        body: 'Her nota için beş şey ölçüldü. Eğittiğimiz her seste parlaklık perdeyle neredeyse birebir yükseliyor — bu kuşlar tonal öttüğü için spektral ağırlık merkezi doğrudan temel frekansı izliyor — ve ikisini birden çizmek aynı gerçeği iki kez çizmek olurdu. Bu yüzden parlaklık renk olarak gösteriliyor; kayma genişliği de nokta boyutu oldu. Geriye kalan üçünün birbirine ne yaptığı her kuşun kendi meselesi; aşağıdaki tablo bir iddia değil, ölçümün kendisi: bir çift birbirine yaslanıyorsa üçüncü eksene dik bakın, yaslanma orada görünür.',
        pairHeading: 'Çift',
        rHeading: 'korelasyon r',
        pairs: {
          pitchBright: 'perde ↔ parlaklık',
          pitchDur: 'perde ↔ süre',
          pitchSlope: 'perde ↔ kayma eğimi',
          durSlope: 'süre ↔ kayma eğimi',
        },
        demoted: 'renge indirildi',
      },
      provenance: {
        title: 'Noktalar nereden geliyor',
        checkpoint: 'Kontrol noktası',
        recordings: 'Kayıt',
        clips: 'klip',
        notes: 'Kullanılabilir nota',
        assignment: 'Atama',
        assignmentBody:
          'Her harf, kendi perdesine en yakın söylenmiş notalar arasından sabit bir tohumla seçilen gerçek bir notayı alır; iki harf aynı notayı paylaşmaz. Nota, mesajları söyleyen aynı modelle üretilir ve buradaki her sayı o üretimden ölçülmüştür.',
        generated: 'Ölçüm',
      },
      reading: {
        title: 'Grafiği okumak',
        spine: 'Perde ölçülmez, atanır. Her harf tam olarak şuradadır:',
        spineAfter:
          'Bu yüzden a→z dikey ekseni dümdüz bir omurga gibi tırmanır. O omurga protokolün kendisidir — parametrik seslerin kullandığı frekans kaydırmalı anahtarlama, bu kez bir model tarafından söyleniyor.',
        scatter:
          'Noktaların sağa-sola ve öne-arkaya yaptığı her şey kuşun kendisidir: her notanın ne kadar hızlı kaydığı ve ne kadar sürdüğü tasarlanmadı, gerçek {species} kayıtlarından ödünç alındı.',
      },
    },

    wildVoices: {
      title: 'Gerçek kuş sesleri',
      lede: 'Bu sayfadaki diğer her şey bizim sesimiz. Bu beşi ise {species} kuşunun kendisi — modelin eğitildiği arşivden. Yanlarında da kod çözücümüzün onlardan okuduğu şey duruyor: tam olarak şu anda çaldığınız dosya üzerinde çalıştırıldı.',
      body: 'Kod çözücü kapalı kümeli: otuz bir harfi var ve “bunların hiçbiri” diyebileceği bir yol yok, bu yüzden her zaman en iyi açıklamasını döndürür. Doğadan bir kayda tutulduğunda kendinden emin biçimde harfler döndürür ve bu harfler hiçbir şey ifade etmez. Farkı söyleyen metin değil, altındaki skordur: bizim motiflerimizden oluşan bütün bir dizinin, bizim sürelerimiz ve bizim aralıklarımızla, kaydın tamamını ne kadar iyi açıkladığı. Gerçek bir kuş bizimkine benzer notalar söyler; ama onları bizim gibi dizmez.',
      clipLabel: 'Saha kaydı',
      readsAs: 'Kod çözücümüz şunu okuyor',
      readsNothing: 'hiçbir şey',
      scoreLabel: 'Skor',
      thresholdLabel: 'inanma eşiği',
      messageScoreLabel: 'kendi mesajımız',
      verdict: 'Eşiğin altında: mesaj olarak okunmadı.',
      statsTitle: 'Hangi beşi ve neden bunlar',
      licensable: 'Gösterilebilen',
      licensableOf: '/ {total} külliyat kaydı',
      recordings: 'Farklı kayıt',
      recordingsNote:
        'Burada yalnızca CC BY-SA lisanslı kayıtlar yayımlanabilir; külliyatın geri kalanı ticari olmayan lisanslarda. Bu, geriye tek bir kayıt bıraktığında beş klip tek bir kuşun beş ayrı bölümüdür.',
      decoderLabel: 'Kod çözücü',
      checkpointLabel: 'Kontrol noktası',
    },
  },

  hero: {
    oneLiner: 'sesin, kuş sesiyle.',
    sub: 'Bir mesaj söyleyin. Kuş olarak ulaşsın — ve okunabilir ulaşsın. Gerçek dünyada bulduğunuz kuşlar, konuşabileceğiniz sesler olur.',
    demoTitle: 'Şimdi dinleyin',
    demoHint: 'Kurulum yok. Kayıt yok.',
  },

  encoder: {
    title: 'Şimdi sizinki',
    hint: 'En fazla 80 karakter. a–z, boşluk ve . , ? ’ seslendirilir; diğerleri duraklamaya dönüşer.',
    placeholderStatic: 'Bir mesaj yazın…',
    button: 'Encode',
    encoding: 'Kodlanıyor…',
    error: 'Kodlanamadı. Tekrar deneyin.',
    unavailable: 'Canlı kodlama yerel bir kopyada çalışır — modelleri ve kayıt derlemini gerektirir, bunlar yayına alınmıyor. Yukarıdaki klipler aynı motorun önceden üretilmiş hali.',
    resultLabel: 'Mesajınız',
    voiceLabel: 'Ses',
    trainedOnLabel: 'Eğitim verisi',
    clips: '{n} klip',
  },

  demo: {
    sourceLabel: 'Söylenen cümle',
    sourceCaption: 'Bir insan diyor ki:',
    encodedLabel: 'Aynı cümle, kuş sesiyle',
    pick: 'Bir ses seçin',
    decodedAs: 'Ulaştığında şöyle çözülür',
    play: 'Çal',
    pause: 'Duraklat',
    replay: 'Tekrar çal',
    transcriptNote:
      'Her mesaj metnini gösterir. Ses deneyimdir; metin ise güvencedir.',
    tierLabel: 'Katman',
    accuracyLabel: 'Çözümleme doğruluğu',
    accuracyNote:
      'Bu dosyayı üreten motorla tekrar metne çözerek ölçüldü.',
    accuracyNoteNeural:
      'Tam olarak bu dosya tekrar metne çözülerek ölçüldü. Bu ses, ızgaradaki sabit tonlar yerine gerçek ve eşit olmayan notalar söyleyen eğitilmiş bir model; bu yüzden FFT ile değil bir motif aramasıyla geri okunur.',
    neuralTag: 'eğitilmiş model',
    // Shown only on the Turkish page. The demo sentence is in English because
    // it genuinely is — the encoder's symbol alphabet has no motifs for ı ğ ş
    // ç ö ü yet, so a Turkish sentence would lose those letters on the way
    // through. Saying so is better than quietly demoing mangled Turkish or
    // implying a capability that does not exist.
    alphabetNote:
      'Demo cümlesi İngilizce: kodlayıcının sembol alfabesi şu an ı ğ ş ç ö ü harflerini içermiyor, bu yüzden Türkçe bir cümle bu harfleri kaybederdi. Türkçe karakter desteği motorun bilinen bir eksiği ve üzerinde çalışılıyor.',
  },

  install: {
    ios: 'App Store’dan indirin',
    android: 'Google Play’den alın',
    soonIos: 'App Store — yakında',
    soonAndroid: 'Google Play — yakında',
    unavailableNote: 'CICI BIRD henüz yayında değil. Hiçbir mağaza kaydı aktif değil.',
  },

  how: {
    title: 'Nasıl çalışır',
    lede: 'Üç adım; ve asıl önemli olan üçüncüsü.',
    steps: [
      {
        title: 'Konuşun',
        body: 'Kayıt düğmesini basılı tutun ve söylemek istediğinizi söyleyin. Hiçbir şey gönderilmeden önce metni görür, sonucu duyarsınız — bir konuşma tanıma hatası asla yanlış bir mesaja dönüşmez.',
      },
      {
        title: 'Kuş sesine dönüşür',
        body: 'Sözleriniz bir motif dizisine kodlanır ve seçtiğiniz türün sesiyle söylenir. Sesinizin üzerine bir filtre değil — o kuşun gerçekte nasıl öttüğünden türetilmiş gerçek bir sembol alfabesi.',
      },
      {
        title: 'Duyar ve okurlar',
        body: 'Alıcıya kuş sesi, altında akan çözülmüş metinle birlikte ulaşır. Sessizde, otobüste, toplantıda: yine de tamamen okunabilir.',
      },
    ],
  },

  collect: {
    eyebrow: 'Farkı yaratan şey',
    title: 'Sesler satın alınmaz, bulunur',
    lede: 'Bunu bir yenilikten fazlası yapan kısım burası. Bir kuşa para verebilirsiniz. Ya da dışarı çıkıp bir tane bulabilirsiniz.',
    body: 'Tanımadığınız bir kuş duyun. CICI BIRD’ü açın, telefonunuzu kaldırın ve kaydedin. Uygulama türü biyoakustik bir modelle tanımlar, kuşun durduğunuz yerde ve zamanda makul olup olmadığını denetler; tutarsa o ses kütüphanenize eklenir. Artık o sesle konuşabilirsiniz.',
    points: [
      {
        title: 'Ekran görüntüsü değil, kayıt',
        body: 'Açılımlar gerçek bir yerde yapılmış gerçek bir kayıttan gelir. Birinin size gönderdiği bir dosya geçmez.',
      },
      {
        title: 'Konum tek bir anlık görüntüdür',
        body: 'Türün orada makul olduğunu doğrulamak için yalnızca kayıt anında bir kez bakılır. Takip değildir. Reddederseniz tanımlama yine çalışır — yalnızca ücretsiz açılım devre dışı kalır.',
      },
      {
        title: 'Ne bulabileceğinize mevsim ve yer karar verir',
        body: 'Kırlangıçlar Türkiye’de mart–ekim arasındadır, ocakta hiçbir yerde yoktur. Bülbül ilkbahar sonunda öter. Katalog yılla birlikte hareket eder, çünkü kuşlar öyle yapar.',
      },
      {
        title: 'Kötü bir kayıt bir suçlama değildir',
        body: 'Doğrulama geçti/kaldı değil, kademelidir. Zayıf bir sonuç size hile yaptığınızı ima eden bir ret değil, kısmi bir açılım ya da bir inceleme kazandırır.',
      },
    ],
    tiersTitle: 'Bir buluş ne değerde',
    tiers: {
      starter: 'Başlangıç türleri en baştan ücretsizdir — serçe, güvercin, karga.',
      basic: 'Temel türler, bulup doğrulattığınızda ücretsiz açılır; mevsimi beklemek istemezseniz küçük bir ücretle de alınabilir.',
      premium: 'Premium türler doğrulanmış bir buluşta ücretsiz açılım yerine indirim verir. Bu kadar istenen bir kuş aksi hâlde katalogda satın alınacak bir şey bırakmazdı.',
    },
  },

  preview: {
    title: 'Lansman kataloğu',
    lede: 'Lansmanda sekiz tür. Üçü zaten sizde, üçünü bulabilirsiniz, ikisi şanstan fazlasını ister.',
    cta: 'Tüm türlere göz atın',
    play: 'Örneği çal',
  },

  credibility: {
    title: 'Gerçek biyoakustik üzerine kurulu',
    body: 'Tür tanımlama, yerleşik bir kuş sesi sınıflandırma modeliyle çalışır — referans mimari BirdNET’tir — ve girdi olarak konum ile yılın zamanını kullanır; makullük denetimini süs olmaktan çıkarıp anlamlı kılan da budur.',
    honestTitle: 'İddia etmeyeceğimiz şey',
    honest: 'Kodlayıcı sesinizi gerçek bir kuşa dönüştürmez. Metni, her türün akustik aralığında ve söyleyişinde işlenen tasarlanmış bir sembol alfabesine kodlar. Güvenilir biçimde çözülmesinin sebebi budur ve sihir ima etmektense bunu söylemeyi tercih ederiz.',
    attributionTitle: 'Atıf',
    attributionNote:
      'Her tür sayfasındaki ses ve görsel künyeleri, elle yazılmaz; her varlığın kendi üstverisinden üretilir. Kaynağı hâlâ doğrulanmakta olan yerlerde sayfa, arkasında duramayacağımız bir atıf basmak yerine bunu açıkça söyler.',
    modelNote:
      'BirdNET model ağırlıkları sürüme göre değişen lisans koşulları taşır. Ticari kullanım, uygun lisanslı modeli ve yazılı teyidi gerektirir; bu bir lansman ön koşuludur, sonradan düşünülecek bir ayrıntı değil.',
  },

  finalCta: {
    title: 'Gidin ve bir kuş bulun.',
    body: 'Sonra birine bunu anlatın — onun sesiyle.',
  },

  message: {
    badge: 'Bir kuş sesi mesajı',
    sentIn: 'Şu türün sesiyle gönderildi',
    playPrompt: 'Mesajı çal',
    transcript: 'Metin',
    liveSubtitle: 'Çözülmüş altyazı',
    subtitleHint: 'Metin ötüşle eşzamanlı belirir. Ses kapalıyken de okunur.',
    replyTitle: 'Kuş sesiyle yanıtlayın',
    replyBody:
      'Buna kendi sesinizle yanıt vermek ve yeni sesler açan kuşları bulmak için CICI BIRD’ü edinin.',
    aboutSpecies: 'Bu tür hakkında',
    expiredTitle: 'Bu bağlantının süresi doldu',
    expiredBody:
      'Paylaşılan kuş sesi bağlantıları varsayılan olarak 30 gün sonra çalışmayı bırakır. Mesajın kendisi kaybolmadı — hâlâ gönderenin sohbetinde. Yeniden paylaşmasını isteyin.',
    revokedTitle: 'Bu bağlantı kapatıldı',
    revokedBody:
      'Gönderen bu bağlantıyı iptal etti. Uygulama dışında paylaşım her mesaj için ayrı ayrı onaylanır ve istendiği zaman geri alınabilir; bu yüzden bir zamanlar çalışan bir bağlantı bilerek çalışmayı bırakabilir.',
    missingTitle: 'Burada bir şey yok',
    missingBody:
      'Bu bağlantı bir mesaja işaret etmiyor. Paylaşılan bağlantılar tasarım gereği uzun ve rastgeledir; tek bir yanlış karakter tam olarak buraya düşer.',
    privacyNote:
      'Mesajlar varsayılan olarak özeldir. Bu mesaj bilerek paylaşıldı. Alıcının adı bu sayfada asla geçmez.',
    demoNotice:
      'Gösterim mesajı. Mesajlaşma altyapısı bu siteye henüz bağlı değil — bunlar gerçek sayfanın sahip olacağı her durumu çalıştıran örneklerdir.',
    expiresIn: 'Bağlantının bitişi',
    sharedOn: 'Paylaşıldı',
  },

  catalog: {
    title: 'Türler',
    lede: 'CICI BIRD’deki her ses, nerede bulunacağı ve bulamazsanız neye mal olacağı.',
    filterTier: 'Katman',
    filterRegion: 'Bölge',
    filterSeason: 'Mevsim',
    filterAll: 'Tümü',
    reset: 'Filtreleri temizle',
    resultsOne: 'tür',
    resultsMany: 'tür',
    empty: 'Bu filtrelere uyan tür yok.',
    findable: 'Doğada bulunabilir',
    purchaseOnly: 'Yalnızca satın alma',
    listen: 'Dinle',
    open: 'Tür sayfasını aç',
    showing: 'Gösterilen',
    of: '/',
    soon: 'Yakında',
    soonNote:
      'Henüz eğitilmiş bir ses yok. Bu kuş şimdilik geçici bir sesle ötüyor; modeli gerçek olana kadar sayfası kapalı.',
  },

  species: {
    scientificName: 'Bilimsel adı',
    alsoKnown: 'Türkçe adı',
    alsoKnownEn: 'İngilizce adı',
    realCall: 'Gerçek ötüşü',
    encodedSample: 'Bu sesle bir mesaj',
    encodedSampleNote: 'Uygulamanın kullandığı motorla kodlandı.',
    score: {
      caption: 'Her nota kendi perdesinde · kaydırın',
      stageLabel:
        'Aşağıdaki mesajın notaya dökülmüş hâli: {species} kuşunun söylediği her nota, söylendiği anda ve perdede. Kayıt çalarken aydınlanır.',
    },
    whereWhen: 'Nerede ve ne zaman',
    regions: 'Yayılış',
    seasons: 'Mevsim',
    habitat: 'Yaşam alanı',
    unlockTitle: 'Katman ve açılım',
    voiceTitle: 'Bu ses nasıl duyulur',
    creditsTitle: 'Künye ve lisans',
    creditsNote: 'Her varlığın üstverisinden üretilir.',
    pendingVerification: 'Kaynak doğrulaması bekleniyor',
    backToCatalog: 'Tüm türler',
    synthesized: 'Sentezlenmiş referans',
    fieldRecording: 'Saha kaydı',
    creditSource: 'Kaynak',
    creditRecordist: 'Kaydeden',
    creditLicence: 'Lisans',
    duration: 'Süre',
    tierNames: {
      starter: 'Başlangıç',
      basic: 'Temel',
      premium: 'Premium',
    },
    model: {
      badge: 'Eğitilmiş ses',
      title: 'Bu ses eğitilmiş bir model',
      body: 'Lansman kataloğunun büyük bölümü elle yazılmış bir sentez profiliyle üretilir. Bu tür öyle değil. Kuşun gerçek kayıtlarına uydurulmuş bir DDSP modeli var ve mesajları yine o kayıtlardan alınan nota motifleriyle söyleniyor — yani duyduğunuz şey modelin çıktısı, ona bir yaklaşım değil.',
      modelLabel: 'Model',
      corpusLabel: 'Eğitim verisi',
      corpusUnit: 'klip',
      decoderLabel: 'Çözücü',
      accuracyLabel: 'Geri çözümlenme',
      accuracyBody: 'Tam olarak bu klip çözücüden yeniden geçirilerek ölçüldü — parametrik seslerin kullandığı sabit ızgaralı FFT ile değil, modelin kendi nota şablonları üzerinde bir motif aramasıyla. Yayın için alt sınır %90.',
      accuracyImperfect: '%100’ün altında geri okunuyor, çünkü eğitilmiş bir ses ızgaradaki sabit tonlar yerine gerçek ve eşit olmayan notalar söyler. Modelin var oluş sebebi olan takas bu; bedeli de tam olarak şu:',
      forkTitle: 'Gerçek bir kuş, mesaj değildir',
      forkBody: 'Çözücü her zaman en iyi okumasını döndürür; dolayısıyla ortada gerçekten bir mesaj olup olmadığına birinin karar vermesi gerekir. Bu sayfanın çaldığı klipler üzerinden ölçüldü:',
      forkMessage: 'Bu mesaj',
      forkWild: 'Aynı türün doğadaki bir kaydı',
      forkThreshold: 'Güven eşiği',
      forkPassed: 'Temiz biçimde ayrıldı.',
    },
    unlockPaths: {
      free: 'En baştan ücretsiz.',
      'field-or-purchase':
        'Doğada bulup doğrulattığınızda ücretsiz, ya da küçük bir satın alma.',
      'field-discount-or-purchase':
        'Doğrulanmış bir buluş %50 indirim sağlar. Aksi hâlde tam ücret.',
      'purchase-only': 'Bu sürümde yalnızca satın alma.',
    },
  },

  regions: {
    europe: 'Avrupa',
    turkiye: 'Türkiye',
    'north-america': 'Kuzey Amerika',
    'north-africa': 'Kuzey Afrika',
    'central-asia': 'Orta Asya',
  },

  seasons: {
    spring: 'İlkbahar',
    summer: 'Yaz',
    autumn: 'Sonbahar',
    winter: 'Kış',
    yearRound: 'Yıl boyu',
  },

  legal: {
    reviewBanner: 'TODO: legal review required before launch',
    reviewBannerBody:
      'Bu belge bir şablondan taslaklanmıştır ve amaçlanan uygulamayı anlatır. Bir hukukçu tarafından incelenmemiştir ve bu hâliyle dayanak alınmamalıdır.',
    trTranslationBanner:
      'Bu belgenin Türkçe çevirisi, Türkiye lansmanından önce hukuki inceleme ile birlikte yayımlanacaktır. Aşağıdaki İngilizce metin şu an için geçerli sürümdür.',
    lastUpdated: 'Son güncelleme',
    contact: 'Bu belgeyle ilgili sorular',
  },

  support: {
    title: 'Destek',
    lede: 'Uygulamanın doğuracağı sorular, siz sormak zorunda kalmadan yanıtlandı.',
    contactTitle: 'Hâlâ takıldıysanız',
    contactBody: 'Bize yazın ve ne olduğunu anlatın. Cihazınızı ve yaklaşık saati ekleyin — sorunu ne kadar hızlı bulacağımızda gerçekten fark yaratır.',
  },

  dataRequest: {
    title: 'Verilerinize erişin veya sildirin',
    lede: 'Gerçekten bir yere giden bir yol. KKVK ve GDPR kapsamında hakkınızda ne tuttuğumuzu sorabilir ve silmemizi isteyebilirsiniz.',
  },

  consent: {
    title: 'Çerezler ve ölçüm',
    body: 'Kaç kişinin bir demoyu çaldığını ve bir bağlantıyı izlediğini ölçüyoruz. Toplu ve kimliksizdir; siz kabul edene kadar cihazınızda hiçbir şey saklanmaz.',
    accept: 'Kabul et',
    decline: 'Reddet',
    more: 'Gizlilik politikasını okuyun',
    declinedNote: 'Reddedildi. Hiçbir ölçüm yapılmıyor.',
  },

  soon: {
    title: 'Henüz değil',
    body: 'Bu sayfa planlandı ama yapılmadı. Lansmanın parçası değil.',
    back: 'Ana sayfaya dön',
  },

  notFound: {
    title: 'Bu sayfa mevcut değil',
    body: 'Bağlantı yanlış olabilir ya da sayfa taşınmış olabilir.',
    home: 'Ana sayfa',
    species: 'Tür kataloğu',
  },

  footer: {
    product: 'Ürün',
    legal: 'Hukuki',
    company: 'Şirket',
    house: 'CICI BIRD bir CICI projesidir.',
    sibling: 'Yine CICI’den',
    rights: 'Tüm hakları saklıdır.',
    language: 'Dil',
  },
}

/**
 * The English dictionary is the shape contract.
 *
 * `en` is deliberately NOT declared `as const`: TypeScript then infers `string`
 * for every value while keeping the key structure exact, which is precisely
 * what a translation target needs. Because `tr` is annotated with this type, a
 * key added to `en` and forgotten in `tr` is a build error rather than a blank
 * space discovered in production.
 */
export type Dictionary = typeof en

const DICTIONARIES: Record<Locale, Dictionary> = { en, tr }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}
