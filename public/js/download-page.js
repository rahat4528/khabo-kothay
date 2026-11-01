// KHABO KOTHAY? - APK Download & QR Code Sharing Controller

const DEFAULT_METADATA = {
  appName: 'KHABO KOTHAY?',
  appNameBn: 'খাবো কোথায়?',
  version: '1.1.0',
  apkSize: '64.98 MB',
  apkSizeBytes: 64024956,
  sha256: '40238FEF2107530877B65E76B7444E4F5A3C2F93CC7DF0A6E69AFFF319F62C3C',
  packageId: 'com.khabokothay.app',
  googleDriveFolderUrl: 'https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu',
  googleDriveUserUrl: 'https://drive.google.com/drive/folders/1IqB-z_mpcQlKE4fgXzq5ZukaP2k9QTnu',
  directDownloadUrl: '/downloads/khabo-kothay-latest.apk'
};

const I18N = {
  en: {
    backToApp: '← Back to App',
    tagline: 'Dhaka Traffic-Aware Dining Recommendation Engine & Personal Food Assistant',
    badgeRelease: 'v1.1.0 Release',
    badgeSize: '64.98 MB',
    badgeAndroid: 'Android 8.0+',
    badgeVerified: 'Verified SHA-256',
    driveTitle: 'Official Google Drive Hosting',
    driveDesc: 'Recommended cloud download hosted on Google Drive. Fast and secure.',
    btnDrive: 'Open Google Drive Download',
    copyDrive: 'Copy Drive Link',
    directTitle: 'Direct Server Mirror',
    directDesc: 'Fast direct download from our application server (Port 3000 / LAN).',
    btnDirect: 'Direct APK Download (61 MB)',
    copyDirect: 'Copy Direct Link',
    qrTitle: 'QR Code Sharing',
    qrSubtitle: 'Scan this QR code with any smartphone camera to open the download page or get the APK.',
    tabSharePage: '📱 Download Page Link',
    tabDriveLink: '☁️ Google Drive Link',
    btnDownloadQr: '📥 Download QR Code (PNG)',
    btnCopyLink: '📋 Copy Link',
    copiedToast: 'Link copied to clipboard!',
    stepsTitle: 'Android Installation Instructions',
    step1Title: '1. Download APK',
    step1Desc: 'Tap the Download button above or scan the QR code using your Android device.',
    step2Title: '2. Allow Download',
    step2Desc: 'If your browser warns "File might be harmful", tap "Download anyway".',
    step3Title: '3. Enable Unknown Apps',
    step3Desc: 'Tap the downloaded APK. If prompted, go to Settings and enable "Allow from this source".',
    step4Title: '4. Install & Launch',
    step4Desc: 'Tap Install and open Khabo Kothay? to begin exploring Dhaka dining.',
    secTitle: 'Security & Integrity Verification',
    secDesc: 'Official APK build fingerprint. Completely virus-free and clean.',
    copyHash: 'Copy SHA-256'
  },
  bn: {
    backToApp: '← মূল অ্যাপে ফিরুন',
    tagline: 'ঢাকার ট্রাফিক সচেতন রেস্তোরাঁ ও ক্যাফে সন্ধানকারী পার্সোনাল ফুড অ্যাসিস্ট্যান্ট',
    badgeRelease: 'v১.১.০ রিলিজ',
    badgeSize: '৬১.০৬ মেগাবাইট',
    badgeAndroid: 'অ্যান্ড্রয়েড ৮.০+',
    badgeVerified: 'যাচাইকৃত SHA-256',
    driveTitle: 'অফিসিয়াল গুগল ড্রাইভ হোস্টিং',
    driveDesc: 'গুগল ড্রাইভে হোস্ট করা অনুমোদিত ক্লাউড ডাউনলোড। নিরাপদ ও দ্রুত।',
    btnDrive: 'গুগল ড্রাইভে খুলুন',
    copyDrive: 'ড্রাইভ লিংক কপি করুন',
    directTitle: 'ডিরেক্ট সার্ভার ডাউনলোড',
    directDesc: 'লোকাল অ্যাপ সার্ভার থেকে সরাসরি হাই-স্পিড APK ডাউনলোড।',
    btnDirect: 'ডিরেক্ট APK ডাউনলোড (৬১ MB)',
    copyDirect: 'ডিরেক্ট লিংক কপি করুন',
    qrTitle: 'QR কোড শেয়ারিং',
    qrSubtitle: 'ফোনের ক্যামেরা দিয়ে QR কোড স্ক্যান করে ডাউনলোড পেজটি খুলুন বা APK ডাউনলোড করুন।',
    tabSharePage: '📱 ডাউনলোড পেজ লিংক',
    tabDriveLink: '☁️ গুগল ড্রাইভ লিংক',
    btnDownloadQr: '📥 QR কোড ডাউনলোড (PNG)',
    btnCopyLink: '📋 লিংক কপি করুন',
    copiedToast: 'লিংক ক্লিপবোর্ডে কপি হয়েছে!',
    stepsTitle: 'অ্যান্ড্রয়েড ইনস্টলেশন নির্দেশিকা',
    step1Title: '১. APK ডাউনলোড করুন',
    step1Desc: 'উপরের ডাউনলোড বাটনে ট্যাপ করুন অথবা ফোনের ক্যামেরা দিয়ে QR কোড স্ক্যান করুন।',
    step2Title: '২. ডাউনলোড অনুমতি দিন',
    step2Desc: 'ব্রাউজারে "File might be harmful" দেখালে নিশ্চিন্তে "Download anyway" চাপুন।',
    step3Title: '৩. আননোন সোর্স অন করুন',
    step3Desc: 'ডাউনলোড হওয়া ফাইলে ক্লিক করে সেটিংস থেকে "Allow from this source" অন করুন।',
    step4Title: '৪. ইনস্টল ও ব্যবহার করুন',
    step4Desc: 'ইনস্টল করে অ্যাপটি ওপেন করুন এবং ঢাকার সেরা খাবার খুঁজে নিন।',
    secTitle: 'নিরাপত্তা ও ইন্টিগ্রিটি যাচাই',
    secDesc: 'অফিসিয়াল APK বিল্ডের নিরাপত্তা হ্যাশ। ১০০% ভাইরাস ও ম্যালওয়্যার মুক্ত।',
    copyHash: 'SHA-256 কপি করুন'
  }
};

let currentLang = localStorage.getItem('khabo_lang') || 'en';
let activeQrMode = 'page'; // 'page' or 'drive'
let appMeta = { ...DEFAULT_METADATA };

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initLanguage();
  await loadMetadata();
  initActions();
  updateQrDisplay();
});

// Theme support (light/dark/system)
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'auto';
  applyTheme(savedTheme);

  const themeBtn = document.getElementById('themeToggleBtn');
  themeBtn?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'auto';
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'auto' : 'dark';
    applyTheme(next);
  });
}

function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('theme', theme);
}

// Language switch
function initLanguage() {
  const langBtn = document.getElementById('langToggleBtn');
  langBtn?.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'bn' : 'en';
    localStorage.setItem('khabo_lang', currentLang);
    applyLanguage();
  });
  applyLanguage();
}

function applyLanguage() {
  const texts = I18N[currentLang] || I18N.en;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (texts[key]) el.textContent = texts[key];
  });
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) {
    langBtn.textContent = currentLang === 'en' ? '🌐 বাংলা' : '🌐 English';
  }
}

// Fetch dynamic metadata from server
async function loadMetadata() {
  try {
    const res = await fetch('/api/download-info');
    if (res.ok) {
      const data = await res.json();
      appMeta = { ...DEFAULT_METADATA, ...data };
    }
  } catch (e) {
    console.warn('Using default download metadata:', e);
  }

  // Update DOM values
  const driveBtn = document.getElementById('driveDownloadBtn');
  if (driveBtn) {
    driveBtn.href = appMeta.googleDriveFolderUrl;
  }

  const directBtn = document.getElementById('directDownloadBtn');
  if (directBtn) {
    directBtn.href = appMeta.directDownloadUrl;
  }

  const shaEl = document.getElementById('shaHashText');
  if (shaEl) {
    shaEl.textContent = appMeta.sha256;
  }

  const versionBadge = document.getElementById('versionBadge');
  if (versionBadge) {
    versionBadge.textContent = `v${appMeta.version} Release`;
  }

  const sizeBadge = document.getElementById('sizeBadge');
  if (sizeBadge) {
    sizeBadge.textContent = appMeta.apkSize || '64.98 MB';
  }
}

// Initialize copy and QR action listeners
function initActions() {
  const tabSharePage = document.getElementById('tabSharePage');
  const tabDriveLink = document.getElementById('tabDriveLink');

  tabSharePage?.addEventListener('click', () => {
    activeQrMode = 'page';
    tabSharePage.classList.add('active');
    tabDriveLink.classList.remove('active');
    updateQrDisplay();
  });

  tabDriveLink?.addEventListener('click', () => {
    activeQrMode = 'drive';
    tabDriveLink.classList.add('active');
    tabSharePage.classList.remove('active');
    updateQrDisplay();
  });

  // Copy share URL button
  document.getElementById('copyShareUrlBtn')?.addEventListener('click', () => {
    const input = document.getElementById('shareUrlInput');
    copyToClipboard(input.value);
  });

  // Copy Drive Link button
  document.getElementById('copyDriveBtn')?.addEventListener('click', () => {
    copyToClipboard(appMeta.googleDriveFolderUrl);
  });

  // Copy Direct Link button
  document.getElementById('copyDirectBtn')?.addEventListener('click', () => {
    const fullDirectUrl = window.location.origin + appMeta.directDownloadUrl;
    copyToClipboard(fullDirectUrl);
  });

  // Copy SHA hash
  document.getElementById('copyShaBtn')?.addEventListener('click', () => {
    copyToClipboard(appMeta.sha256);
  });

  // Download QR Code PNG button
  document.getElementById('downloadQrBtn')?.addEventListener('click', () => {
    downloadQrPng();
  });
}

function getCurrentTargetUrl() {
  if (activeQrMode === 'drive') {
    return appMeta.googleDriveFolderUrl;
  }
  // Default: download page shareable link
  return window.location.origin + '/download';
}

function updateQrDisplay() {
  const targetUrl = getCurrentTargetUrl();
  const input = document.getElementById('shareUrlInput');
  if (input) input.value = targetUrl;

  const qrImg = document.getElementById('qrCodeImage');
  if (qrImg) {
    if (activeQrMode === 'drive') {
      qrImg.src = '/downloads/khabo-kothay-drive-qr.png';
      qrImg.alt = 'QR Code for Google Drive APK';
    } else {
      qrImg.src = '/downloads/khabo-kothay-qr.png';
      qrImg.alt = 'QR Code for Download Page';
    }
  }
}

function downloadQrPng() {
  const targetUrl = getCurrentTargetUrl();
  const link = document.createElement('a');
  if (activeQrMode === 'drive') {
    link.href = '/downloads/khabo-kothay-drive-qr.png';
    link.download = 'khabo-kothay-drive-qr.png';
  } else {
    link.href = '/downloads/khabo-kothay-qr.png';
    link.download = 'khabo-kothay-apk-qr.png';
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 Downloading QR Code image...');
}

// Robust clipboard copy with fallback
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(I18N[currentLang]?.copiedToast || 'Link copied to clipboard!');
      return;
    }
  } catch (err) {
    // fallback
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast(I18N[currentLang]?.copiedToast || 'Link copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy. Please manually copy the link.');
  }
}

function showToast(msg) {
  let toast = document.getElementById('dlToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dlToast';
    toast.className = 'dl-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
