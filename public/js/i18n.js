/**
 * Khabo Kothay? (খাবো কোথায়?) - Web Bilingual Translation Dictionary
 * Full parity between English and Bengali (বাংলা)
 */

export const TRANSLATIONS = {
  en: {
    appName: 'Khabo Kothay?',
    appNameBn: 'খাবো কোথায়?',
    appTagline: 'Dhaka Dining Intelligence',
    navOverview: 'Overview',
    navSearch: 'Search',
    navTopPicks: 'Top Picks',
    navFilters: 'Filters',
    navLiveMap: 'Live Map',
    navSaved: 'Saved',
    navCompare: 'Compare',
    navGroupPlanner: 'Group Planner',
    navCostEstimator: 'Cost Estimator',
    navProfile: 'Profile',
    navHistory: 'History',
    installApp: 'Install',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',

    // Hero
    heroCategory: 'Restaurant Intelligence & Discovery',
    heroTitleLine1: 'Decide where',
    heroTitleLine2: 'to eat in Dhaka.',
    heroDesc: 'Real-time traffic-aware dining recommendations, live travel times, accurate Rickshaw & CNG fares, and actual menu budget filters across all Dhaka neighborhoods.',
    heroExplore: 'Explore recommendations',
    heroAreasBadge: '100+ Dhaka Neighborhoods',
    heroLiveBadge: '● Live Traffic & Fares',
    heroMeta: 'Dhaka dining intelligence.',

    // Location
    locationPrompt: '📍 Where are you right now?',
    useGps: 'Use Current GPS',
    locating: 'Locating...',
    startingFrom: 'Starting from:',

    // Tabs
    tabStandard: '🔍 Standard Search',
    tabMealTime: '⏱️ Meal-Time Mode',

    // Cues
    moodPrompt: '✨ What are you in the mood for?',
    cuisinePrompt: '🍴 Or choose a specific cuisine',
    priorityPrompt: '🎯 What matters most to you?',
    radiusPrompt: '📍 Distance Radius & Operating Hours',
    anyDistance: 'Any Distance',
    openNowOnly: '🕒 Open Now Only',
    budgetPrompt: 'Budget:',
    surpriseMe: '🎲 Surprise Me',
    findBestOption: '🚀 Find My Best Option',

    // Priorities
    prioBestOverall: '🌟 Best Overall',
    prioFastest: '⚡ Fastest to Reach',
    prioClosest: '📍 Closest Distance',
    prioCheapest: '💰 Cheapest',
    prioBestRated: '⭐ Best Rated',
    prioBestValue: '💎 Best Value',
    prioPersonalized: '🧬 Personalized',

    // Filters Sidebar
    filterTitle: 'Filters',
    filterReset: '🔄 Reset',
    priceRange: 'Price Range',
    availability: 'Availability',
    openNow: 'Open Now',
    closingSoon: 'Closing Soon (within 60m)',
    openLate: 'Open Late (past 11:30 PM)',
    cuisine: 'Cuisine',
    restaurantType: 'Restaurant Type',
    dietaryPrefs: 'Dietary Preferences',
    features: 'Features & Amenities',
    appliedFilters: 'Applied:',
    clearAll: 'Clear All',

    // Results & Map
    resultsHeading: 'Recommended Restaurants',
    resultsShowing: 'Showing matches',
    resultsCount: '%{count} places ranked',
    interactiveMap: 'Interactive Area Map',
    mapSub: 'All Dhaka Areas',

    // Top Picks
    topPicksTitle: 'For you right now',
    bestMatch: '🌟 Best Match',
    fastestOption: '⚡ Fastest Option',
    trySomethingNew: '🎲 Try Something New',

    // Cards
    cardRank: '#',
    estimatedTransit: 'Estimated Transit:',
    estimatedTag: 'estimated',
    verifiedTag: 'verified',
    cardMenuBtn: '🍽️ Menu & Prices',
    cardRoutesBtn: '🔄 Routes',
    cardWhyBtn: '📊 Why this pick?',
    cardDirectionsBtn: '🧭 Directions',
    reviews: 'reviews',
    perPerson: '/person',

    // Modals
    close: '✕',
    cancel: 'Cancel',
    save: 'Save',
    reset: 'Reset',
    retry: 'Try Again',

    // Group Planner
    groupPlannerTitle: '👥 Group Food Planner',
    groupPlannerDesc: 'Find dining spots that satisfy everyone in your friends or family group without budget clashes.',
    groupAddMember: '+ Add Group Member',
    groupMemberName: 'Member Name',
    groupMaxBudget: 'Max Budget (BDT)',
    groupDietary: 'Dietary Needs',
    groupFindMatch: '🔍 Find Group Consensus Recommendations',
    groupConsensusSummary: 'Group Budget Consensus',
    groupConflictsHeading: '⚠️ Identified Group Conflicts',

    // Cost Estimator
    costEstimatorTitle: '🧮 Meal Cost Estimator',
    costEstimatorDesc: 'Accurately estimate total food budget for 1 to 10 people including verified prices, VAT, and service charge.',
    costHeadcount: 'Number of Diners (People)',
    costCostPerPerson: 'Base Price Per Person (BDT)',
    costAddVat: 'Add 15% VAT (Govt. Standard)',
    costAddServiceCharge: 'Add 10% Service Charge (Upscale Dining)',
    costEstimatedTotal: 'Estimated Grand Total',
    costPerPersonSplit: 'Cost Per Diner',

    // Food Profile
    profileTitle: '🥗 Personal Food Profile',
    preferredCuisines: '🍴 Preferred Cuisines',
    targetBudgetRange: '💰 Target Budget Range (BDT per person)',
    dietaryRestrictions: '🌱 Dietary Preferences',
    dislikedFoods: '🚫 Disliked Foods / Ingredients',
    saveProfile: 'Save Profile',
    resetProfile: 'Reset to Default',

    // Offline & Errors
    offlineBanner: '⚠️ You are currently offline. Showing cached restaurants and saved favorites.',
    offlineBadge: '📦 Cached Offline Data',
    errorTitle: 'Unable to load recommendations',
    errorDesc: 'An unexpected error occurred while contacting the server.',
    emptyTitle: 'No restaurants found',
    emptyDesc: 'No open places matched your current filters. Try expanding your budget or picking a different cuisine.'
  },
  bn: {
    appName: 'খাবো কোথায়?',
    appNameBn: 'Khabo Kothay?',
    appTagline: 'ঢাকার লাইভ রেস্তোরাঁ ও ফুড ইন্টেলিজেন্স',
    navOverview: 'পরিচিতি',
    navSearch: 'খুঁজুন',
    navTopPicks: 'সেরা পছন্দ',
    navFilters: 'ফিল্টার',
    navLiveMap: 'লাইভ ম্যাপ',
    navSaved: 'সংরক্ষিত',
    navCompare: 'তুলনা',
    navGroupPlanner: 'গ্রুপ প্ল্যানার',
    navCostEstimator: 'খরচ হিসাব',
    navProfile: 'প্রোফাইল',
    navHistory: 'ইতিহাস',
    installApp: 'ইনস্টল',
    themeAuto: 'স্বয়ংক্রিয়',
    themeLight: 'লাইট মোড',
    themeDark: 'ডার্ক মোড',

    // Hero
    heroCategory: 'রেস্তোরাঁ ইন্টেলিজেন্স ও ডিসকভারি',
    heroTitleLine1: 'এখন কোথায়',
    heroTitleLine2: 'খাবেন ঢাকায়?',
    heroDesc: 'রিয়েল-টাইম ট্রাফিক পরিস্থিতি, ভ্রমণের প্রকৃত সময়, সঠিক রিকশা ও সিএনজি ভাড়া এবং নির্ভরযোগ্য মেনু বাজেট সহ সমগ্র ঢাকার রেস্তোরাঁ নির্দেশিকা।',
    heroExplore: 'সুপারিশগুলো দেখুন',
    heroAreasBadge: '১০০+ ঢাকার এলাকা',
    heroLiveBadge: '● লাইভ ট্রাফিক ও ভাড়া',
    heroMeta: 'ঢাকার সেরা খাবার সহায়িকা।',

    // Location
    locationPrompt: '📍 আপনি এখন কোথায় আছেন?',
    useGps: 'বর্তমান জিপিএস ব্যবহার করুন',
    locating: 'লোকেশন খোঁজা হচ্ছে...',
    startingFrom: 'শুরু করছেন:',

    // Tabs
    tabStandard: '🔍 সাধারণ অনুসন্ধান',
    tabMealTime: '⏱️ খাওয়ার সময় মোড',

    // Cues
    moodPrompt: '✨ এখন কী ধরনের খাবার খেতে মন চাচ্ছে?',
    cuisinePrompt: '🍴 অথবা নির্দিষ্ট একটি খাবার নির্বাচন করুন',
    priorityPrompt: '🎯 আপনার কাছে সবচেয়ে গুরুত্বপূর্ণ কোনটি?',
    radiusPrompt: '📍 দূরত্বের পরিধি এবং খোলার সময়',
    anyDistance: 'যেকোনো দূরত্ব',
    openNowOnly: '🕒 শুধু খোলা আছে এমন',
    budgetPrompt: 'বাজেট:',
    surpriseMe: '🎲 সারপ্রাইজ মি',
    findBestOption: '🚀 আমার জন্য সেরা রেস্তোরাঁ খুঁজুন',

    // Priorities
    prioBestOverall: '🌟 সেরা সামগ্রিক',
    prioFastest: '⚡ দ্রুততম পৌঁছানো',
    prioClosest: '📍 সবচেয়ে কাছে',
    prioCheapest: '💰 সবচেয়ে সাশ্রয়ী',
    prioBestRated: '⭐ সর্বোচ্চ রেটিং',
    prioBestValue: '💎 সেরা মান ও দাম',
    prioPersonalized: '🧬 ব্যক্তিগত পছন্দ',

    // Filters Sidebar
    filterTitle: 'ফিল্টার সমূহ',
    filterReset: '🔄 রিসেট',
    priceRange: 'মূল্যের পরিসীমা (টাকা)',
    availability: 'উপলব্ধতা',
    openNow: 'এখন খোলা আছে',
    closingSoon: 'শীঘ্রই বন্ধ হবে (৬০ মিনিটের মধ্যে)',
    openLate: 'দেরি রাত পর্যন্ত খোলা (রাত ১১:৩০+) ',
    cuisine: 'খাবারের ধরন',
    restaurantType: 'রেস্তোরাঁর ধরন',
    dietaryPrefs: 'খাবার সচেতনতা ও খাদ্যাভ্যাস',
    features: 'সুবিধাসমূহ',
    appliedFilters: 'প্রয়োগকৃত:',
    clearAll: 'সব মুছুন',

    // Results & Map
    resultsHeading: 'সুপারিশকৃত রেস্তোরাঁসমূহ',
    resultsShowing: 'ফলাফল প্রদর্শিত',
    resultsCount: '%{count} টি স্থান তালিকাভুক্ত',
    interactiveMap: 'ইন্টারেক্টিভ এরিয়া ম্যাপ',
    mapSub: 'ঢাকার সকল এলাকা',

    // Top Picks
    topPicksTitle: 'আপনার জন্য এই মুহূর্তের সেরা পছন্দ',
    bestMatch: '🌟 সেরা মিল',
    fastestOption: '⚡ দ্রুততম পৌঁছানোর বিকল্প',
    trySomethingNew: '🎲 নতুন কিছু পরখ করুন',

    // Cards
    cardRank: '#',
    estimatedTransit: 'আনুমানিক যাতায়াত:',
    estimatedTag: 'আনুমানিক',
    verifiedTag: 'যাচাইকৃত',
    cardMenuBtn: '🍽️ মেনু ও দাম',
    cardRoutesBtn: '🔄 রুট বিকল্প',
    cardWhyBtn: '📊 কেন এই পছন্দ?',
    cardDirectionsBtn: '🧭 পথনির্দেশ',
    reviews: 'রিভিউ',
    perPerson: '/জনপ্রতি',

    // Modals
    close: '✕',
    cancel: 'বাতিল',
    save: 'সংরক্ষণ করুন',
    reset: 'রিসেট',
    retry: 'আবার চেষ্টা করুন',

    // Group Planner
    groupPlannerTitle: '👥 গ্রুপ ফুড প্ল্যানার',
    groupPlannerDesc: 'বন্ধু এবং পরিবারের সবার আলাদা বাজেট ও পছন্দের সমন্বয়ে নিখুঁত রেস্তোরাঁ নির্বাচন করুন।',
    groupAddMember: '+ গ্রুপের সদস্য যোগ করুন',
    groupMemberName: 'সদস্যের নাম',
    groupMaxBudget: 'সর্বোচ্চ বাজেট (টাকা)',
    groupDietary: 'খাদ্যাভ্যাস',
    groupFindMatch: '🔍 সবার পছন্দের উপযুক্ত রেস্তোরাঁ খুঁজুন',
    groupConsensusSummary: 'গ্রুপ বাজেট ঐকমত্য',
    groupConflictsHeading: '⚠️ গ্রুপ পছন্দের অসঙ্গতি',

    // Cost Estimator
    costEstimatorTitle: '🧮 খাবারের খরচ হিসাবকারী',
    costEstimatorDesc: '১ থেকে ১০ জনের জন্য খাবার বিল, ভ্যাট ও সার্ভিস চার্জের নিখুঁত হিসাব করুন।',
    costHeadcount: 'অতিথির সংখ্যা (জন)',
    costCostPerPerson: 'জনপ্রতি আনুমানিক খাবার খরচ (টাকা)',
    costAddVat: '১৫% সরকারি ভ্যাট যোগ করুন',
    costAddServiceCharge: '১০% রেস্তোরাঁ সার্ভিস চার্জ যোগ করুন',
    costEstimatedTotal: 'সর্বমোট সম্ভাব্য বিল',
    costPerPersonSplit: 'জনপ্রতি প্রদেয় অংশ',

    // Food Profile
    profileTitle: '🥗 ব্যক্তিগত ফুড প্রোফাইল',
    preferredCuisines: '🍴 পছন্দের খাবার সমূহ',
    targetBudgetRange: '💰 লক্ষ্য বাজেট পরিসীমা (জনপ্রতি টাকা)',
    dietaryRestrictions: '🌱 বিশেষ খাদ্যাভ্যাস',
    dislikedFoods: '🚫 অপছন্দের উপাদান / খাবার',
    saveProfile: 'প্রোফাইল সংরক্ষণ করুন',
    resetProfile: 'ডিফল্টে ফিরে যান',

    // Offline & Errors
    offlineBanner: '⚠️ আপনি অফলাইনে আছেন। সংরক্ষিত রেস্তোরাঁ ও সাম্প্রতিক তালিকা প্রদর্শিত হচ্ছে।',
    offlineBadge: '📦 অফলাইন ক্যাশ ডেটা',
    errorTitle: 'রেস্তোরাঁ লোড করা সম্ভব হয়নি',
    errorDesc: 'সার্ভারের সাথে যোগাযোগের সময় সমস্যা দেখা দিয়েছে।',
    emptyTitle: 'কোনো রেস্তোরাঁ পাওয়া যায়নি',
    emptyDesc: 'আপনার ফিল্টারের সাথে মিলে এমন কোনো খোলা স্থান নেই। বাজেট বৃদ্ধি করে বা অন্য খাবার নির্বাচন করে চেষ্টা করুন।'
  }
};

let currentLang = 'en';

export function initI18n() {
  try {
    const saved = localStorage.getItem('khabo_lang');
    if (saved === 'bn' || saved === 'en') {
      currentLang = saved;
    }
  } catch (e) {}
  applyTranslations();
  return currentLang;
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'bn') return;
  currentLang = lang;
  try {
    localStorage.setItem('khabo_lang', lang);
  } catch (e) {}
  applyTranslations();
}

export function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'bn' : 'en');
  return currentLang;
}

export function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let text = dict[key] || TRANSLATIONS.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`%\\{${k}\\}`, 'g'), v);
  }
  return text;
}

export function applyTranslations() {
  document.documentElement.lang = currentLang;

  // Toggle button label
  const toggleBtn = document.getElementById('langToggleBtn');
  if (toggleBtn) {
    toggleBtn.innerHTML = currentLang === 'en'
      ? '<span>🌐</span> বাংলা'
      : '<span>🌐</span> English';
    toggleBtn.title = currentLang === 'en' ? 'Switch to Bangla' : 'Switch to English';
  }

  // Translate all elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Translate all elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });
}
