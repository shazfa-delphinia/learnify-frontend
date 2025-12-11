// =====================================
// 1. KONFIG API DICODING
// =====================================
const API_URL_learning_paths = "https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/learning_paths";
const API_URL_courses = "https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/courses";
const API_URL_course_levels = "https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/course_levels";
const API_URL_tutorials = "https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/tutorials";

const API_KEY = "sb_publishable_h889CjrPIGwCMA9I4oTTaA_2L22Y__R";

// Penampung data
let dbLearningPaths = [];
let dbCourses = [];
let dbCourseLevels = [];
let dbTutorials = [];

let knowledgeBase = [];
let staticRoadmapData = null;
const CHAT_HISTORY_PREFIX = "chatHistory_";
const CHAT_HISTORY_GUEST = "chatHistory_guest";
const LOGIN_PAGE = "auth/signin.html";
let isRestoringHistory = false;

// Map learning path name to tech quiz category
function mapLearningPathToTechCategory(lpNameRaw = "") {
  const lpName = (lpNameRaw || "").toLowerCase().trim();
  const mapping = {
    "ai engineer": "machine learning",
    "gen ai engineer": "machine learning",
    "mlops engineer": "machine learning",
    "data scientist": "data",
    "google cloud professional": "cloud computing",
    "devops engineer": "cloud computing",
    "android developer": "android",
    "ios developer": "ios",
    "multi-platform app developer": "multi platform",
    "front-end web developer": "web",
    "react developer": "web",
    "back-end developer javascript": "web",
    "back-end developer python": "web",
  };

  return mapping[lpName] || "";
}

// Map learning path name to Dicoding learning path URL
function mapLearningPathToUrl(lpNameRaw = "") {
  const lpName = (lpNameRaw || "").toLowerCase().trim();
  const mapping = {
    "ai engineer": "https://www.dicoding.com/learningpaths/65",
    "gen ai engineer": "https://www.dicoding.com/learningpaths/68",
    "mlops engineer": "https://www.dicoding.com/learningpaths/30",
    "data scientist": "https://www.dicoding.com/learningpaths/60",
    "front-end web developer": "https://www.dicoding.com/learningpaths/22",
    "react developer": "https://www.dicoding.com/learningpaths/58",
    "back-end developer python": "https://www.dicoding.com/learningpaths/62",
    "back-end developer javascript": "https://www.dicoding.com/learningpaths/41",
    "devops engineer": "https://www.dicoding.com/learningpaths/53",
    "android developer": "https://www.dicoding.com/learningpaths/7",
    "multi-platform app developer": "https://www.dicoding.com/learningpaths/21",
    "ios developer": "https://www.dicoding.com/learningpaths/9",
    "google cloud professional": "https://www.dicoding.com/learningpaths/52",
  };

  return mapping[lpName] || "";
}

// Force login before accessing chat/quiz
function requireLoginForChat(event) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const hasUserId = !!localStorage.getItem("userId");
  if (isLoggedIn && hasUserId) return true;
  if (event) {
    event.preventDefault?.();
    event.stopPropagation?.();
  }
  window.location.href = LOGIN_PAGE;
  return false;
}

// Prevent chat history loss on localStorage.clear
const __origLocalStorageClear = localStorage.clear.bind(localStorage);
localStorage.clear = function () {
  const backups = {};
  Object.keys(localStorage)
    .filter((k) => k.startsWith(CHAT_HISTORY_PREFIX))
    .forEach((k) => {
      backups[k] = localStorage.getItem(k);
    });
  const guestBackup = localStorage.getItem(CHAT_HISTORY_GUEST);
  __origLocalStorageClear();
  Object.entries(backups).forEach(([k, v]) => localStorage.setItem(k, v));
  if (guestBackup) localStorage.setItem(CHAT_HISTORY_GUEST, guestBackup);
};

function persistChatMessage(entry) {
  const userId = localStorage.getItem("userId");
  const key = userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST;
  const existing = JSON.parse(localStorage.getItem(key) || "[]");
  existing.push(entry);
  if (existing.length > 300) existing.shift(); // keep size bounded
  localStorage.setItem(key, JSON.stringify(existing));
}

function restoreChatHistory() {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return;
  const userId = localStorage.getItem("userId");
  const key = userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST;
  const saved = JSON.parse(localStorage.getItem(key) || "[]");
  if (!saved.length || !window.addMessage) return;
  isRestoringHistory = true;
  saved.forEach((msg) => {
    window.addMessage(msg.content || msg.text || "", msg.role || "bot", !!msg.isHTML, { skipPersist: true });
  });
  isRestoringHistory = false;
}

// Load static roadmap JSON once
async function ensureStaticRoadmapData() {
  if (staticRoadmapData !== null) return staticRoadmapData;
  try {
    const res = await fetch("Data/roadmap.json");
    if (!res.ok) throw new Error(`Failed to load roadmap.json: ${res.status}`);
    staticRoadmapData = await res.json();
  } catch (e) {
    console.error("Failed to load static roadmap data:", e);
    staticRoadmapData = null;
  }
  return staticRoadmapData;
}

// Build roadmap object from static JSON
function buildRoadmapFromStatic(lpNameRaw = "", userLevel = "beginner") {
  if (!staticRoadmapData) return null;
  const lpKey = Object.keys(staticRoadmapData).find((k) => k.toLowerCase() === lpNameRaw.toLowerCase());
  if (!lpKey) return null;

  const courses = (staticRoadmapData[lpKey] || []).map((c, idx) => ({
    id: `${lpKey}-${idx + 1}`,
    course_name: c.course_name || c.title || `Course ${idx + 1}`,
    level: c.course_level || c.level || "",
    course_order: idx + 1,
    tutorials: (c.tutorials || []).map((t, tIdx) => ({
      id: `${lpKey}-${idx + 1}-${tIdx + 1}`,
      title: t,
      tutorial_order: tIdx + 1,
    })),
  }));

  return {
    user_level: userLevel || "beginner",
    learning_path_name: lpKey,
    learning_path: {
      name_lp: lpKey,
      summary: "",
      course: courses,
    },
  };
}

// Fallback: bangun roadmap dari data lokal (Supabase REST + localStorage)
function buildRoadmapFromLocalData() {
  const storedLpName = (localStorage.getItem("userLearningPath") || "").toLowerCase();
  const userLevel = localStorage.getItem("userLevel") || "beginner";

  if (!storedLpName || dbLearningPaths.length === 0) {
    console.log("Tidak ada learning path di localStorage atau data LP belum di-load");
    return null;
  }

  const lp = dbLearningPaths.find((lp) => {
    const candidates = [lp.name_lp, lp.learning_path_name, lp.title].filter(Boolean).map((s) => s.toLowerCase());

    return candidates.includes(storedLpName);
  });

  if (!lp) {
    console.log("Learning path tidak ditemukan di dbLearningPaths untuk:", storedLpName);
    return null;
  }

  const lpId = lp.id;

  const courses = dbCourses
    .filter((c) => c.lp_id === lpId || c.learning_path_id === lpId)
    .map((c) => {
      const tutorials = dbTutorials.filter((t) => t.course_id === c.id);
      return {
        ...c,
        tutorials,
      };
    });

  return {
    user_level: userLevel,
    // ini yang dipakai header
    learning_path_name: lp.name_lp || lp.learning_path_name || lp.title || storedLpName,
    learning_path: {
      ...lp,
      course: courses,
    },
  };
}

// Helper fetch
async function fetchDicoding(url) {
  const res = await fetch(`${url}?apikey=${API_KEY}`);
  return res.json();
}

// Ambil semua data sekali di awal
async function loadAllData() {
  try {
    const [learningPaths, courses, courseLevels, tutorials] = await Promise.all([fetchDicoding(API_URL_learning_paths), fetchDicoding(API_URL_courses), fetchDicoding(API_URL_course_levels), fetchDicoding(API_URL_tutorials)]);

    console.log("LEARNING PATHS:", learningPaths);
    console.log("COURSES:", courses);
    console.log("COURSE LEVELS:", courseLevels);
    console.log("TUTORIALS:", tutorials);

    dbLearningPaths = learningPaths;
    dbCourses = courses;
    dbCourseLevels = courseLevels;
    dbTutorials = tutorials;

    // ==========================
    // BANGUN KNOWLEDGE BASE DI SINI
    // ==========================
    knowledgeBase = [];

    // learning paths
    dbLearningPaths.forEach((lp) => {
      knowledgeBase.push({
        type: "learning_path",
        title: lp.learning_path_name || lp.title || "",
        description: lp.learning_path_description || lp.description || lp.short_description || "",
        raw: lp,
      });
    });

    // courses
    dbCourses.forEach((c) => {
      knowledgeBase.push({
        type: "course",
        title: c.course_name || c.title || "",
        description: c.course_description || c.description || c.short_description || "",
        raw: c,
      });
    });

    // tutorials
    dbTutorials.forEach((t) => {
      knowledgeBase.push({
        type: "tutorial",
        title: t.tutorial_title || t.title || "",
        description: t.description || t.short_description || "",
        raw: t,
      });
    });

    console.log("KNOWLEDGE BASE:", knowledgeBase.length, "item");
  } catch (e) {
    console.error("Gagal akses API:", e);
  }
}

// =====================================
// 2. OTAK CHATBOT: pilih jawaban paling relevan
// =====================================
function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúà-ùü \-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(userText, itemTitle) {
  const u = normalize(userText);
  const t = normalize(itemTitle);

  if (!t) return 0;

  // kalau judul full ada di pertanyaan → skor tinggi
  if (u.includes(t)) return 1.0;

  const uWords = new Set(u.split(" ").filter(Boolean));
  const tWords = t.split(" ").filter(Boolean);
  if (!tWords.length) return 0;

  let matchCount = 0;
  tWords.forEach((w) => {
    if (uWords.has(w)) matchCount++;
  });

  return matchCount / tWords.length; // 0–1
}

function getAnswerFromDicoding(userText) {
  if (!knowledgeBase.length) {
    return "Sebentar ya… aku masih memuat data dari Dicoding 🙂";
  }

  let bestItem = null;
  let bestScore = 0;

  knowledgeBase.forEach((item) => {
    const score = scoreMatch(userText, item.title);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  });

  console.log("BEST MATCH:", { bestItem, bestScore });

  // kalau skor terlalu kecil, anggap tidak relevan
  if (!bestItem || bestScore < 0.25) {
    return "Maaf, aku tidak menemukan materi yang pas. Coba gunakan nama course atau learning path yang lebih spesifik ya 😊";
  }

  const title = bestItem.title || "(tanpa judul)";
  const desc = bestItem.description && bestItem.description.trim().length > 0 ? bestItem.description : "Belum ada deskripsi yang jelas di data.";

  if (bestItem.type === "learning_path") {
    return `👍 Learning Path yang paling relevan:\n\n${title}\n\n${desc}`;
  }

  if (bestItem.type === "course") {
    return `📘 Course yang paling relevan:\n\n${title}\n\n${desc}`;
  }

  if (bestItem.type === "tutorial") {
    return `📙 Tutorial paling relevan:\n\n${title}\n\n${desc}`;
  }

  return `Berikut materi paling relevan:\n\n${title}\n\n${desc}`;
}

// Format AI response to be more readable with HTML
function formatAIResponse(text) {
  if (!text) return text;

  // Convert markdown-style formatting to HTML
  let formatted = String(text);

  // First, convert **bold** to <strong> (do this first before processing lists)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #ffffff; font-weight: 600;">$1</strong>');

  // Split text into sections (by double newlines)
  const sections = formatted.split(/\n\n+/);
  const processedSections = [];
  let currentList = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    // Check if this section is a numbered list item (starts with number.)
    const listMatch = section.match(/^(\d+)\.\s+(.+)$/s);

    if (listMatch) {
      // It's a list item
      const num = listMatch[1];
      let content = listMatch[2].trim();

      // Convert single newlines within list item to <br>
      content = content.replace(/\n/g, "<br>");

      currentList.push(`<li style="margin: 10px 0; padding-left: 5px; line-height: 1.7; color: #ffffff;"><strong style="color: #ffffff; font-weight: 600;">${num}.</strong> ${content}</li>`);
    } else {
      // Not a list item - close current list if any
      if (currentList.length > 0) {
        processedSections.push(`<ul style="margin: 12px 0; padding-left: 20px; list-style: none;">${currentList.join("")}</ul>`);
        currentList = [];
      }

      // Convert single newlines to <br>
      const paraContent = section.replace(/\n/g, "<br>");
      processedSections.push(`<p style="margin: 12px 0; line-height: 1.8; color: #ffffff;">${paraContent}</p>`);
    }
  }

  // Close any remaining list
  if (currentList.length > 0) {
    processedSections.push(`<ul style="margin: 12px 0; padding-left: 20px; list-style: none;">${currentList.join("")}</ul>`);
  }

  // Join all sections
  formatted = processedSections.join("");

  // Wrap in a container div
  formatted = `<div style="color: #ffffff; line-height: 1.7;">${formatted}</div>`;

  return formatted;
}

// =====================================
// ROADMAP FUNCTIONS
// =====================================

// Get user roadmap from backend
async function getUserRoadmap(userId) {
  try {
    const response = await fetch(`http://localhost:5000/user/${userId}/roadmap`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Failed to fetch roadmap:", response.status, errorData);
      throw new Error(errorData.error || "Failed to fetch roadmap");
    }
    const data = await response.json();
    console.log("Roadmap data received:", data);

    if (data.roadmaps && data.roadmaps.length > 0) {
      console.log("Found roadmap:", data.roadmaps[0]);
      return data.roadmaps[0];
    }

    console.log("No roadmap found in response");
    return null;
  } catch (error) {
    console.error("Error fetching roadmap:", error);
    return null;
  }
}

// Get user progress from backend
async function getUserProgress(userId) {
  try {
    const response = await fetch(`http://localhost:5000/user/${userId}/progress`);
    if (!response.ok) {
      throw new Error("Failed to fetch progress");
    }
    const data = await response.json();
    return data.progress || [];
  } catch (error) {
    console.error("Error fetching progress:", error);
    return [];
  }
}

// Resolve LP display name with graceful fallback
function resolveLearningPathName(lp = {}, roadmap = {}) {
  return (
    lp.name_lp ||
    lp.learning_path_name ||
    lp.title ||
    roadmap.learning_path_name ||
    roadmap.learning_path_title ||
    roadmap.learning_path ||
    ""
  );
}

// Format roadmap to HTML
function formatRoadmapHTML(roadmap, progress = []) {
  if (!roadmap || !roadmap.learning_path) {
    return '<p style="color: #ffffff;">Roadmap belum tersedia. Silakan selesaikan kuis terlebih dahulu.</p>';
  }

  const lp = roadmap.learning_path;
  const courses = lp.course || [];
  const lpName = resolveLearningPathName(lp, roadmap) || "N/A";
  const lpSummary = lp.summary || lp.learning_path_description || lp.description;
  const lpUrlRaw = mapLearningPathToUrl(lpName) || `https://www.dicoding.com/search?keyword=${encodeURIComponent(lpName)}`;
  const lpUrl = lpUrlRaw.replace(/"/g, "&quot;");

  // Create progress map for adaptive roadmap
  const progressMap = {};
  progress.forEach((p) => {
    if (p.tutorials && p.tutorials.course) {
      const courseId = p.tutorials.course.id;
      const tutorialId = p.tutorials.id;
      if (!progressMap[courseId]) {
        progressMap[courseId] = {};
      }
      progressMap[courseId][tutorialId] = {
        status: p.status,
        percentage: p.progress_percentage || 0,
      };
    }
  });

  let html = `
    <div style="color: #ffffff; line-height: 1.7;">
      <div onclick="window.open('${lpUrl}', '_blank')" style="background: rgba(255, 255, 255, 0.1); padding: 16px; border-radius: 12px; margin-bottom: 16px; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 12px rgba(0,0,0,0.18)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';">
        <h3 style="margin: 0 0 12px 0; color: #ffffff; font-size: 20px; font-weight: bold;">📘 Roadmap Pembelajaran</h3>
        <p style="margin: 8px 0; color: #ffffff;"><strong>Learning Path:</strong> ${lpName}</p>
        <p style="margin: 8px 0; color: #ffffff;"><strong>Level Skill:</strong> ${roadmap.user_level || "N/A"}</p>
        ${lpSummary ? `<p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">${lpSummary}</p>` : ""}
        <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.75); font-size: 12px;">Klik untuk membuka halaman learning path di Dicoding.</p>
      </div>
      
      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px; font-weight: 600;">📚 Modul Pembelajaran</h4>
  `;

  // Sort courses by course_order
  const sortedCourses = [...courses].sort((a, b) => (a.course_order || 0) - (b.course_order || 0));

  sortedCourses.forEach((course, courseIdx) => {
    const courseName = course.course_name || "Course";
    const courseLinkRaw = course.course_url || course.url || course.link || course.course_link || course.external_url;
    const lpUrl = mapLearningPathToUrl(lpName);
    const courseLink = courseLinkRaw || lpUrl || `https://www.dicoding.com/search?keyword=${encodeURIComponent(courseName)}`;
    const safeCourseLink = courseLink.replace(/"/g, "&quot;");
    const courseProgress = progressMap[course.id] || {};
    const tutorials = course.tutorials || [];
    const sortedTutorials = [...tutorials].sort((a, b) => (a.tutorial_order || 0) - (b.tutorial_order || 0));

    // Calculate course completion
    let completedTutorials = 0;
    let totalTutorials = sortedTutorials.length;
    sortedTutorials.forEach((tutorial) => {
      const tutProgress = courseProgress[tutorial.id];
      if (tutProgress && tutProgress.status === "completed") {
        completedTutorials++;
      }
    });
    const courseCompletion = totalTutorials > 0 ? Math.round((completedTutorials / totalTutorials) * 100) : 0;

    // Determine course status
    let statusIcon = "⏳";
    let statusText = "Belum dimulai";
    if (courseCompletion === 100) {
      statusIcon = "✅";
      statusText = "Selesai";
    } else if (courseCompletion > 0) {
      statusIcon = "🔄";
      statusText = "Sedang dikerjakan";
    }

    html += `
      <div onclick="window.open('${safeCourseLink}', '_blank')" style="background: rgba(255, 255, 255, 0.08); padding: 16px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid ${courseCompletion === 100 ? "#4caf50" : courseCompletion > 0 ? "#ff9800" : "#2196f3"}; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 12px rgba(0,0,0,0.18)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <h5 style="margin: 0 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
              ${courseIdx + 1}. ${courseName}
            </h5>
            ${course.level ? `<span style="color: rgba(255, 255, 255, 0.7); font-size: 13px;">Level: ${course.level}</span>` : ""}
            ${course.hours_to_study ? `<span style="color: rgba(255, 255, 255, 0.7); font-size: 13px; margin-left: 8px;">⏱️ ${course.hours_to_study} jam</span>` : ""}
          </div>
          <div style="text-align: right;">
            <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${statusIcon} ${statusText}</span>
            ${totalTutorials > 0 ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 12px; margin-top: 4px;">${completedTutorials}/${totalTutorials} tutorial</div>` : ""}
          </div>
        </div>
        
        ${
          courseCompletion > 0
            ? `
          <div style="background: rgba(0, 0, 0, 0.2); border-radius: 8px; height: 8px; margin: 8px 0; overflow: hidden;">
            <div style="background: ${courseCompletion === 100 ? "#4caf50" : "#ff9800"}; height: 100%; width: ${courseCompletion}%; transition: width 0.3s ease;"></div>
          </div>
        `
            : ""
        }
        
        ${
          sortedTutorials.length > 0
            ? `
          <div style="margin-top: 12px; padding-left: 12px;">
            ${sortedTutorials
              .map((tutorial, tutIdx) => {
                const tutProgress = courseProgress[tutorial.id];
                const isCompleted = tutProgress && tutProgress.status === "completed";
                const isInProgress = tutProgress && tutProgress.status === "in_progress";
                const tutIcon = isCompleted ? "✅" : isInProgress ? "🔄" : "⭕";
                const tutColor = isCompleted ? "rgba(76, 175, 80, 0.9)" : isInProgress ? "rgba(255, 152, 0, 0.9)" : "rgba(255, 255, 255, 0.6)";

                return `
                <div style="margin: 6px 0; color: ${tutColor}; font-size: 14px;">
                  ${tutIcon} ${tutorial.title || `Tutorial ${tutIdx + 1}`}
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  });

  html += `
      </div>
      
      <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 8px; margin-top: 16px; font-size: 13px; color: rgba(255, 255, 255, 0.9);">
        <strong>💡 Tips:</strong> Ikuti modul berdasarkan urutan. Selesaikan semua tutorial dalam satu modul sebelum lanjut ke modul berikutnya.
      </div>
    </div>
  `;

  return html;
}

// Display roadmap to chat
async function displayRoadmap(userId = null) {
  const actualUserId = userId || localStorage.getItem("userId");

  if (!actualUserId) {
    if (window.addMessage) {
      window.addMessage("Silakan login terlebih dahulu untuk melihat roadmap.", "bot");
    }
    return;
  }

  // Tampilkan pesan loading
  if (window.addMessage) {
    window.addMessage("📋 Memuat roadmap kamu...", "bot");
  }

  try {
    const storedLpName = (localStorage.getItem("userLearningPath") || "").toLowerCase();

    // Coba ambil dari backend (Supabase via Node)
    let [roadmap, progress] = await Promise.all([getUserRoadmap(actualUserId), getUserProgress(actualUserId)]);

    // Pastikan static roadmap data tersedia untuk fallback sinkron dengan LP user
    await ensureStaticRoadmapData();

    if (roadmap && storedLpName) {
      const fetchedLpName = (resolveLearningPathName(roadmap.learning_path, roadmap) || "").toLowerCase();
      if (fetchedLpName && fetchedLpName !== storedLpName) {
        const localRoadmap = buildRoadmapFromLocalData();
        if (localRoadmap) {
          roadmap = localRoadmap;
        }
      }
    }

    // Pastikan roadmap mengikuti learning path user dengan static JSON (kurasi lokal)
    if (staticRoadmapData) {
      const preferredLpName = storedLpName || (roadmap ? resolveLearningPathName(roadmap.learning_path, roadmap) : "");
      if (preferredLpName) {
        const staticRoadmap = buildRoadmapFromStatic(preferredLpName, (roadmap && roadmap.user_level) || localStorage.getItem("userLevel") || "beginner");
        if (staticRoadmap) {
          roadmap = staticRoadmap;
        }
      }
    }

    // Kalau backend tidak punya roadmap, coba bangun dari data lokal
    if (!roadmap) {
      console.log("Backend tidak mengembalikan roadmap, mencoba buildRoadmapFromLocalData() ...");
      roadmap = buildRoadmapFromLocalData();
    }

    // Kalau masih tidak ada tetap kasih pesan "belum tersedia"
    if (!roadmap) {
      const chatMessagesEl = document.getElementById("chat-messages");
      if (chatMessagesEl && chatMessagesEl.lastElementChild) {
        const lastMsg = chatMessagesEl.lastElementChild;
        if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Memuat roadmap")) {
          lastMsg.remove();
        }
      }

      if (window.addMessage) {
        window.addMessage("Roadmap belum tersedia. Silakan selesaikan kuis terlebih dahulu untuk mendapatkan roadmap pembelajaran kamu.", "bot");
      }
      return;
    }

    // Roadmap sudah ada (dari backend atau fallback) render
    const roadmapHTML = formatRoadmapHTML(roadmap, progress || []);

    // Hapus pesan "Memuat..."
    const chatMessagesEl = document.getElementById("chat-messages");
    if (chatMessagesEl && chatMessagesEl.lastElementChild) {
      const lastMsg = chatMessagesEl.lastElementChild;
      if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Memuat roadmap")) {
        lastMsg.remove();
      }
    }

    if (window.addMessage) {
      window.addMessage(roadmapHTML, "bot", true);
    }
  } catch (error) {
    console.error("Error displaying roadmap:", error);

    const chatMessagesEl = document.getElementById("chat-messages");
    if (chatMessagesEl && chatMessagesEl.lastElementChild) {
      const lastMsg = chatMessagesEl.lastElementChild;
      if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Memuat roadmap")) {
        lastMsg.remove();
      }
    }

    if (window.addMessage) {
      window.addMessage("Maaf, terjadi kesalahan saat memuat roadmap. Silakan coba lagi nanti.", "bot");
    }
  }
}

// Make displayRoadmap globally accessible
window.displayRoadmap = displayRoadmap;

// =====================================
// GLOBAL FUNCTIONS (defined before DOMContentLoaded)
// =====================================

function addMessageCore(text, role = "user", isHTML = false, options = {}) {
  const skipPersist = options.skipPersist;
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return;

  const bubble = document.createElement("div");
  bubble.classList.add("bubble", role === "user" ? "bubble-user" : "bubble-bot");

  if (isHTML) {
    bubble.innerHTML = text;
  } else {
    bubble.textContent = text;
  }

  chatMessagesEl.appendChild(bubble);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  if (!skipPersist && !isRestoringHistory) {
    persistChatMessage({ text, content: text, role, isHTML });
  }
  return true;
}

// Make addMessage accessible globally (base implementation)
window.addMessage = addMessageCore;

// Save chat history to localStorage (make it global)
window.saveChatHistory = function () {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return;

  const userId = localStorage.getItem("userId");

  const messages = [];
  chatMessagesEl.querySelectorAll(".bubble").forEach((bubble) => {
    const role = bubble.classList.contains("bubble-user") ? "user" : "bot";
    const isHTML = bubble.innerHTML !== bubble.textContent;
    const content = isHTML ? bubble.innerHTML : bubble.textContent;

    // Skip quiz HTML and welcome messages
    if (content.includes("start-quiz-welcome-btn") || content.includes("continue-tech-quiz-btn")) {
      return;
    }

    messages.push({ role, content, isHTML });
  });

  // Save per user (or guest) history only
  const key = userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST;
  localStorage.setItem(key, JSON.stringify(messages));
};

// Load chat history from localStorage (make it global)
window.loadChatHistory = function () {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return false;

  const userId = localStorage.getItem("userId");

  const savedHistory = localStorage.getItem(userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST);
  if (!savedHistory) return false;

  try {
    const messages = JSON.parse(savedHistory);
    if (messages.length === 0) return false;

    // Clear existing messages
    chatMessagesEl.innerHTML = "";

    // Restore messages
    isRestoringHistory = true;
    messages.forEach((msg) => {
      addMessageCore(msg.content || msg.text || "", msg.role === "user" ? "user" : "bot", !!msg.isHTML, { skipPersist: true });
    });
    isRestoringHistory = false;

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return true;
  } catch (error) {
    console.error("Error loading chat history:", error);
    return false;
  }
};

// Flag to prevent duplicate welcome messages (global)
window.welcomeMessageShown = false;

// Check quiz status and show welcome message
window.checkQuizStatusAndWelcome = async function () {
  console.log("checkQuizStatusAndWelcome called");

  // Prevent duplicate calls
  if (window.welcomeMessageShown) {
    console.log("Welcome message already shown, skipping...");
    return;
  }

  // Ensure chatbot is visible first
  const chatbot = document.getElementById("chatbot");
  const landing = document.getElementById("landing");
  if (chatbot && landing) {
    if (chatbot.style.display === "none" || !chatbot.style.display) {
      console.log("Chatbot not visible, making it visible...");
      landing.style.display = "none";
      chatbot.style.display = "block";
    }
  }

  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) {
    console.log("chat-messages not found, retrying...");
    setTimeout(() => window.checkQuizStatusAndWelcome(), 200);
    return;
  }

  console.log("chat-messages found, checking for existing messages...");

  // Try to load chat history first
  const historyLoaded = window.loadChatHistory ? window.loadChatHistory() : false;
  const hasMessages = chatMessages.children.length > 0;

  if (hasMessages || historyLoaded) {
    console.log("Messages already exist or history loaded, skipping welcome");
    window.welcomeMessageShown = true;
    return;
  }

  console.log("No messages found, showing welcome...");
  window.welcomeMessageShown = true; // Set flag before showing message

  const userId = localStorage.getItem("userId");
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  console.log("User status:", { userId, isLoggedIn, addMessageExists: typeof window.addMessage });

  if (!isLoggedIn || !userId) {
    console.log("User not logged in, showing basic welcome");
    if (window.addMessage) {
      console.log("Calling addMessage for non-logged user...");
      const result = window.addMessage("Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis, atau tanyakan sesuatu tentang materi belajar! 😊", "bot");
      console.log("addMessage result:", result);
    } else {
      console.error("window.addMessage is not a function!");
    }
    return;
  }

  console.log("User is logged in, checking quiz result...");
  try {
    const response = await fetch(`http://localhost:5000/user/${userId}/has-quiz-result`);
    console.log("Fetch response status:", response.status);
    const data = await response.json();
    console.log("Quiz result data:", data);

    if (!response.ok) {
      throw new Error(data.error || "Gagal mengecek status kuis");
    }

    if (!data.hasQuizResult) {
      console.log("User has no quiz result, showing quiz welcome");
      const welcomeHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 15px;">
          <h3 style="margin-top: 0; color: white;">👋 Halo! Selamat datang di Learnify!</h3>
          <p style="margin-bottom: 15px;">Saya Learning Buddy, siap membantu kamu menemukan learning path yang tepat sesuai dengan minat dan skill kamu.</p>
          <p style="margin-bottom: 15px;"><strong>Yuk, mulai dengan mengerjakan kuis dulu!</strong> Kuis ini akan membantu saya memahami minat dan level skill kamu.</p>
          <button class="start-quiz-welcome-btn" style="padding: 12px 24px; background: white; color: #667eea; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px;">
            🎯 Mulai Kuis Sekarang
          </button>
        </div>
      `;
      if (window.addMessage) {
        console.log("Calling addMessage with quiz welcome HTML...");
        window.addMessage(welcomeHTML, "bot", true);
        console.log("addMessage called for quiz welcome");
      } else {
        console.error("window.addMessage is not a function when trying to show quiz welcome!");
      }

      setTimeout(() => {
        const btn = document.querySelector(".start-quiz-welcome-btn");
        if (btn) {
          console.log("Start quiz button found, adding event listener");
          btn.addEventListener("click", () => {
            if (window.showQuizOptions) {
              window.showQuizOptions();
            }
          });
        } else {
          console.warn("Start quiz button not found");
        }
      }, 100);
    } else {
      console.log("User already has quiz result, showing welcome back message");

      // Get learning path and level from response or localStorage
      const learningPath = data.learningPath || localStorage.getItem("userLearningPath") || "";
      const userLevel = data.userLevel || localStorage.getItem("userLevel") || "";

      // Update localStorage if we got new data from server
      if (data.learningPath) localStorage.setItem("userLearningPath", data.learningPath);
      if (data.userLevel) localStorage.setItem("userLevel", data.userLevel);

      let welcomeMessage = "Halo! Selamat datang kembali! 😊";
      if (learningPath) {
        welcomeMessage += `\n\nSaya ingat, learning path kamu adalah <strong>${learningPath}</strong>`;
        if (userLevel) {
          welcomeMessage += ` dengan level <strong>${userLevel}</strong>`;
        }
        welcomeMessage += ".\n\nAda yang bisa saya bantu hari ini?";
      } else {
        welcomeMessage += " Ada yang bisa saya bantu hari ini?";
      }

      if (window.addMessage) {
        console.log("Calling addMessage for returning user...");
        window.addMessage(welcomeMessage, "bot", true);
        console.log("addMessage called for returning user");
      } else {
        console.error("window.addMessage is not a function when trying to show welcome back!");
      }
    }
  } catch (error) {
    console.error("Check quiz status error:", error);
    console.log("Showing fallback welcome message due to error");
    if (window.addMessage) {
      window.addMessage("Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis, atau tanyakan sesuatu tentang materi belajar! 😊", "bot");
    } else {
      console.error("window.addMessage is not a function in error handler!");
    }
  }
};

// =====================================
// 3. UI: SIDEBAR + CHATBOT
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  // 1. Load data API
  loadAllData();

  // 2. Sidebar toggle
  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.querySelector(".list-icon"); // tombol kotak

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("minimized");
    });
  }

  // 3. Chatbot
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  // Welcome message akan dipanggil saat chatbot dibuka (bukan di DOMContentLoaded)

  // Use unified addMessage implementation
  window.addMessage = (text, role = "user", isHTML = false, options = {}) => addMessageCore(text, role, isHTML, options);

  // Restore chat history immediately
  restoreChatHistory();

  // Redirect any chat-related click to login if not logged in
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".quiz-btn, .start-quiz-welcome-btn, #chat-form button, #chat-input, .chat-btn, [data-open-chatbot]");
    if (!trigger) return;
    requireLoginForChat(e);
  });

  // Make showQuizOptions accessible globally
  window.showQuizOptions = async function () {
    if (window.addMessage) {
      window.addMessage("Halo! Saya bisa membantu kamu menemukan learning path yang tepat dengan kuis. Pilih jenis kuis yang ingin kamu ikuti:", "bot");
    }

    const quizOptions = `
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
        <button class="quiz-btn" data-type="interest" style="padding: 12px; background: #4A90E2; color: white; border: none; border-radius: 8px; cursor: pointer; text-align: left;">
          📋 Kuis Interest (Menentukan Minat)
        </button>
        <button class="quiz-btn" data-type="tech" style="padding: 12px; background: #4A90E2; color: white; border: none; border-radius: 8px; cursor: pointer; text-align: left;">
          💻 Kuis Technical (Menentukan Level Skill)
        </button>
      </div>
    `;

    if (window.addMessage) {
      window.addMessage(quizOptions, "bot", true);
    }

    // Add event listeners after a short delay to ensure DOM is ready
    setTimeout(() => {
      document.querySelectorAll(".quiz-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const quizType = e.target.closest(".quiz-btn").dataset.type;
          if (window.startQuiz) {
            window.startQuiz(quizType);
          }
        });
      });
    }, 100);
  };

  // Make startQuiz accessible globally
  window.startQuiz = async function (quizType) {
    try {
      if (window.addMessage) {
        window.addMessage(`Memuat kuis ${quizType === "interest" ? "Interest" : "Technical"}...`, "bot");
      }

      let endpoint = "http://localhost:5000/quiz/csv/interest/questions";

      if (quizType === "tech") {
        const storedLp = localStorage.getItem("userLearningPath") || window.currentLearningPath || "";
        const techCategory = mapLearningPathToTechCategory(storedLp);

        if (techCategory) {
          endpoint = `http://localhost:5000/quiz/csv/tech/questions?tech_category=${encodeURIComponent(techCategory)}`;
          if (window.addMessage) {
            window.addMessage(`Menyiapkan soal technical untuk learning path: ${storedLp} (kategori: ${techCategory}).`, "bot");
          }
        } else {
          endpoint = "http://localhost:5000/quiz/csv/tech/questions";
          if (window.addMessage && storedLp) {
            window.addMessage(`Learning path "${storedLp}" belum punya kategori khusus, menampilkan soal technical campuran.`, "bot");
          }
        }
      }

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!response.ok || !data.questions) {
        throw new Error(data.error || "Gagal memuat kuis");
      }

      if (quizType === "tech" && Array.isArray(data.questions) && data.questions.length === 0) {
        if (window.addMessage) {
          window.addMessage("Soal technical untuk learning path kamu belum tersedia. Menampilkan soal campuran sebagai gantinya.", "bot");
        }
        const fallbackResponse = await fetch("http://localhost:5000/quiz/csv/tech/questions");
        const fallbackData = await fallbackResponse.json();
        data.questions = fallbackData.questions || [];
      }

      // Initialize quizAnswers if not exists (to store both interest and tech answers)
      if (!window.quizAnswers) {
        window.quizAnswers = {
          interest: [],
          tech: {},
        };
      }

      // Store questions globally
      window.currentQuiz = {
        type: quizType,
        questions: data.questions,
        currentIndex: 0,
        answers: [],
      };

      displayQuestion(0);
    } catch (error) {
      console.error("Quiz error:", error);
      if (window.addMessage) {
        window.addMessage(`Maaf, terjadi kesalahan: ${error.message}. Pastikan backend server sudah running.`, "bot");
      }
    }
  };

  // Display question
  function displayQuestion(index) {
    const quiz = window.currentQuiz;
    if (!quiz || index >= quiz.questions.length) {
      finishQuiz();
      return;
    }

    // Prevent displaying the same question twice
    if (quiz.lastDisplayedIndex === index) {
      console.log("Question already displayed, skipping...");
      return;
    }
    quiz.lastDisplayedIndex = index;

    const question = quiz.questions[index];
    let questionHTML = `
      <div style="margin-bottom: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: rgba(255, 255, 255, 0.9);"><strong>Pertanyaan ${index + 1}/${quiz.questions.length}</strong></div>
        <div style="margin-bottom: 18px; font-weight: 500; font-size: 16px; line-height: 1.5;">${question.question_text}</div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
    `;

    question.options.forEach((option, optIndex) => {
      const optionText = option.option_text || option.text || option;
      const optionLabel = option.label || String.fromCharCode(65 + optIndex);
      questionHTML += `
        <button class="option-btn" data-index="${index}" data-option="${optIndex}" 
          style="padding: 14px 16px; background: white; border: 2px solid #23436a; border-radius: 10px; cursor: pointer; text-align: left; font-size: 15px; color: #23436a; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); width: 100%;">
          <span style="font-weight: bold; margin-right: 8px;">${optionLabel}.</span>${optionText}
        </button>
      `;
    });

    questionHTML += `</div></div>`;

    if (window.addMessage) {
      window.addMessage(questionHTML, "bot", true);
    }

    // Add event listeners (only once per button)
    setTimeout(() => {
      document.querySelectorAll(".option-btn").forEach((btn) => {
        // Skip if button already has event listener
        if (btn.dataset.listenerAdded === "true") {
          return;
        }
        btn.dataset.listenerAdded = "true";

        // Add click event
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          // Prevent multiple clicks
          if (this.disabled) return;

          const qIndex = parseInt(this.dataset.index);
          const optIndex = parseInt(this.dataset.option);
          selectAnswer(qIndex, optIndex);
        });

        // Add hover effect styling
        btn.addEventListener("mouseenter", function () {
          if (!this.disabled) {
            this.style.background = "#f0f8ff";
            this.style.borderColor = "#1399dc";
            this.style.transform = "translateY(-2px)";
          }
        });

        btn.addEventListener("mouseleave", function () {
          if (!this.disabled) {
            this.style.background = "white";
            this.style.borderColor = "#23436a";
            this.style.transform = "translateY(0)";
          }
        });
      });
    }, 100);
  }

  // Select answer
  function selectAnswer(questionIndex, optionIndex) {
    const quiz = window.currentQuiz;
    if (!quiz) return;

    // Prevent multiple clicks on the same question
    if (quiz.currentIndex !== questionIndex) {
      console.log("Question index mismatch, ignoring click");
      return;
    }

    const question = quiz.questions[questionIndex];
    const selectedOption = question.options[optionIndex];

    // Disable all buttons to prevent double clicks
    document.querySelectorAll(".option-btn").forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    });

    // Store answer in current quiz
    if (quiz.type === "interest") {
      quiz.answers.push(selectedOption.option_text || selectedOption.text);
    } else {
      const questionText = question.question_text;
      quiz.answers[questionText] = selectedOption.text || selectedOption.option_text;
    }

    // Also store in global quizAnswers
    if (!window.quizAnswers) {
      window.quizAnswers = {
        interest: [],
        tech: {},
      };
    }

    if (quiz.type === "interest") {
      window.quizAnswers.interest.push(selectedOption.option_text || selectedOption.text);
    } else {
      const questionText = question.question_text;
      window.quizAnswers.tech[questionText] = selectedOption.text || selectedOption.option_text;
    }

    // Show selected answer
    if (window.addMessage) {
      window.addMessage(`Jawaban: ${selectedOption.option_text || selectedOption.text}`, "user");
    }

    // Move to next question
    quiz.currentIndex = questionIndex + 1;

    if (quiz.currentIndex < quiz.questions.length) {
      setTimeout(() => displayQuestion(quiz.currentIndex), 500);
    } else {
      finishQuiz();
    }
  }

  // Finish quiz and send to ML
  async function finishQuiz() {
    const quiz = window.currentQuiz;
    if (!quiz) return;

    if (window.addMessage) {
      window.addMessage("Terima kasih! Saya sedang memproses jawabanmu untuk menentukan learning path terbaik...", "bot");
    }

    try {
      const userId = localStorage.getItem("userId");

      // Prepare data for ML pipeline using global quizAnswers
      const requestBody = {
        user_interest_answers: (window.quizAnswers && window.quizAnswers.interest) || [],
        user_tech_answers_mcq: (window.quizAnswers && window.quizAnswers.tech) || {},
        student_id: userId || null,
      };

      const response = await fetch("http://localhost:5000/quiz/ml/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal memproses hasil kuis");
      }

      // Persist chosen learning path early so Technical quiz can be aligned
      if (result.chosen_learning_path) {
        window.currentLearningPath = result.chosen_learning_path;
        localStorage.setItem("userLearningPath", result.chosen_learning_path || "");
      }
      if (result.detected_level) {
        localStorage.setItem("userLevel", result.detected_level);
      }
      if (result.interest_category) {
        localStorage.setItem("userInterestCategory", result.interest_category);
      }

      // Check if this is only Interest quiz (no Tech quiz yet)
      const hasInterest = window.quizAnswers && window.quizAnswers.interest && window.quizAnswers.interest.length > 0;
      const hasTech = window.quizAnswers && window.quizAnswers.tech && Object.keys(window.quizAnswers.tech).length > 0;
      const isOnlyInterest = hasInterest && !hasTech && quiz.type === "interest";

      // Save result to database if user is logged in (only if both quizzes are done or if it's a complete result)
      let roadmapSaved = false;
      if (userId && result.chosen_learning_path && (hasTech || !isOnlyInterest)) {
        try {
          console.log("Saving roadmap to database...", {
            user_id: userId,
            learning_path_name: result.chosen_learning_path,
            user_level: result.detected_level || "beginner",
          });

          // Save roadmap to database (mark that user has completed quiz)
          const saveResponse = await fetch("http://localhost:5000/user/roadmap/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: userId,
              learning_path_name: result.chosen_learning_path, // Use name to find LP ID
              user_level: result.detected_level || "beginner",
            }),
          });

          if (saveResponse.ok) {
            const saveData = await saveResponse.json();
            roadmapSaved = true;
            console.log("✅ Roadmap saved successfully:", saveData);
          } else {
            const errorData = await saveResponse.json().catch(() => ({}));
            console.error("❌ Error saving roadmap:", saveResponse.status, errorData);

            // Show user-friendly error message
            if (window.addMessage) {
              window.addMessage(`⚠️ Roadmap tidak bisa disimpan ke database: ${errorData.error || errorData.note || "Learning path tidak ditemukan"}. Roadmap tetap akan ditampilkan dari hasil kuis.`, "bot");
            }
          }

          // Save learning path and level to localStorage for quick access
          localStorage.setItem("userLearningPath", result.chosen_learning_path || "");
          localStorage.setItem("userLevel", result.detected_level || "beginner");
          if (result.interest_category) {
            localStorage.setItem("userInterestCategory", result.interest_category);
          }
        } catch (saveError) {
          console.error("Error saving roadmap:", saveError);
          // Continue even if save fails, but still save to localStorage
          localStorage.setItem("userLearningPath", result.chosen_learning_path || "");
          localStorage.setItem("userLevel", result.detected_level || "beginner");
          if (result.interest_category) {
            localStorage.setItem("userInterestCategory", result.interest_category);
          }
        }
      }

      // Display results
      let resultHTML = "";

      if (isOnlyInterest) {
        // Show Interest quiz result first (learning path)
        resultHTML = `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-top: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.15);">
            <h3 style="margin-top: 0; color: white; font-size: 20px;">🎯 Learning Path Kamu</h3>
            <p style="font-size: 18px; margin: 15px 0; color: white; font-weight: bold;">${result.chosen_learning_path || "Belum ditentukan"}</p>
            ${result.interest_category ? `<p style="margin-bottom: 0; color: rgba(255,255,255,0.9);">Kategori: ${result.interest_category}</p>` : ""}
          </div>
        `;
      } else {
        // Show complete result (both quizzes done)
        resultHTML = `
          <div style="background: #ffffff; padding: 20px; border-radius: 12px; margin-top: 10px; border: 2px solid #23436a; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #23436a; font-size: 20px;">📊 Hasil Kuis Lengkap</h3>
            <div style="color: #000000; line-height: 1.8;">
              <p style="margin: 12px 0;"><strong style="color: #23436a;">Learning Path yang Direkomendasikan:</strong><br><span style="color: #000000; font-size: 16px;">${result.chosen_learning_path || "Belum ditentukan"}</span></p>
              ${result.detected_level ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Level Skill:</strong><br><span style="color: #000000;">${result.detected_level}</span></p>` : ""}
              ${result.interest_category ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Kategori Interest:</strong><br><span style="color: #000000;">${result.interest_category}</span></p>` : ""}
              ${
                result.tech_percent_correct !== undefined
                  ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Skor Technical:</strong><br><span style="color: #000000; font-size: 18px; font-weight: bold;">${result.tech_percent_correct.toFixed(1)}%</span></p>`
                  : ""
              }
            </div>
          </div>
        `;
      }

      if (window.addMessage) {
        window.addMessage(resultHTML, "bot", true);
      }

      // If only Interest quiz is done, show result and then require Technical quiz
      if (isOnlyInterest) {
        setTimeout(() => {
          const continueHTML = `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #2196f3;">
              <p style="margin-top: 0; margin-bottom: 12px; color: #000000;"><strong>📋 Langkah Selanjutnya</strong></p>
              <p style="margin-bottom: 12px; color: #000000;">Sekarang kamu sudah tahu learning path yang cocok untukmu! Untuk menentukan level skill yang tepat, kamu perlu mengerjakan kuis Technical.</p>
              <button class="continue-tech-quiz-btn" style="padding: 12px 24px; background: #1399dc; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; width: 100%;">
                🎯 Lanjut Kuis Technical
              </button>
            </div>
          `;

          if (window.addMessage) {
            window.addMessage(continueHTML, "bot", true);
          }

          // Add event listener for button
          setTimeout(() => {
            const continueBtn = document.querySelector(".continue-tech-quiz-btn");

            if (continueBtn) {
              continueBtn.addEventListener("click", () => {
                if (window.startQuiz) {
                  window.startQuiz("tech");
                }
              });

              // Auto-scroll to button
              continueBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
        }, 1000);

        // Don't clear quiz answers yet - keep them for when Technical quiz is done
        // Don't save to database yet - wait until both quizzes are complete
        window.currentQuiz = null;
      } else {
        // Both quizzes done (Interest + Technical) - Technical quiz just completed
        // Result already shown above, just show completion message
        const completionHTML = `
          <div style="margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32; font-weight: bold; font-size: 16px;">✅ Hasil kuismu sudah tersimpan!</p>
            <p style="margin: 8px 0 0 0; color: #1b5e20;">Sekarang kamu bisa bertanya tentang materi belajar atau learning path kamu.</p>
          </div>
        `;

        if (window.addMessage) {
          window.addMessage(completionHTML, "bot", true);
        }

        // Display roadmap after quiz completion
        // Wait a bit longer to ensure roadmap is saved in database, then try to display
        setTimeout(async () => {
          if (userId && window.displayRoadmap) {
            // Try to display roadmap, with retry if needed
            let retries = 3;
            let roadmapDisplayed = false;

            while (retries > 0 && !roadmapDisplayed) {
              console.log(`Attempting to display roadmap (retry ${4 - retries}/3)...`);
              await window.displayRoadmap(userId);

              // Check if roadmap was displayed (by checking last message)
              await new Promise((resolve) => setTimeout(resolve, 1000));

              const chatMessagesEl = document.getElementById("chat-messages");
              if (chatMessagesEl && chatMessagesEl.lastElementChild) {
                const lastMsg = chatMessagesEl.lastElementChild;
                const lastText = lastMsg.textContent || "";
                const lastHTML = lastMsg.innerHTML || "";

                // If it says roadmap is not available, try again
                if (lastText.includes("Roadmap belum tersedia") || lastText.includes("Memuat roadmap")) {
                  if (retries > 1) {
                    // Remove the "not available" message and try again
                    console.log("Roadmap not found, retrying...");
                    lastMsg.remove();
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                  }
                } else if (lastHTML.includes("Roadmap Pembelajaran") || lastHTML.includes("Modul Pembelajaran")) {
                  // Roadmap was successfully displayed
                  console.log("Roadmap displayed successfully");
                  roadmapDisplayed = true;
                } else {
                  // Some other message, assume it worked
                  roadmapDisplayed = true;
                }
              } else {
                roadmapDisplayed = true;
              }

              retries--;
            }
          }
        }, 2500);

        // Clear quiz and answers after both are complete
        window.currentQuiz = null;
        window.quizAnswers = {
          interest: [],
          tech: {},
        };
      }
    } catch (error) {
      console.error("ML prediction error:", error);
      let errorMessage = `Maaf, terjadi kesalahan saat memproses hasil: ${error.message}`;

      // Check if it's a connection error
      if (error.message.includes("fetch") || error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        errorMessage = `Maaf, tidak dapat terhubung ke server. Pastikan backend server sudah running di port 5000 dan ML server sudah running di port 8000.`;
      } else if (error.message.includes("503") || error.message.includes("ML server")) {
        errorMessage = `Maaf, ML server tidak dapat diakses. Pastikan ML server sudah running di port 8000. Coba jalankan: python ml_server.py`;
      }

      if (window.addMessage) {
        window.addMessage(errorMessage, "bot");
      }
    }
  }

  // checkQuizStatusAndWelcome sudah didefinisikan di luar DOMContentLoaded (line 207)
  // Tidak perlu didefinisikan lagi di sini

  if (chatForm && chatInput && chatMessages) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!requireLoginForChat(e)) return;

      const text = chatInput.value.trim();
      if (!text) return;

      // tampilkan pesan user
      if (window.addMessage) {
        window.addMessage(text, "user");
      }
      chatInput.value = "";

      console.log("User tanya:", text);

      // Check if user wants to start quiz
      const textLower = text.toLowerCase();
      if (textLower.includes("kuis") || textLower.includes("quiz") || textLower.includes("test") || textLower.includes("mulai kuis")) {
        if (window.showQuizOptions) {
          window.showQuizOptions();
        }
        return;
      }

      // Check if user asks about roadmap
      if (
        textLower.includes("roadmap") ||
        textLower.includes("peta belajar") ||
        textLower.includes("rencana belajar") ||
        (textLower.includes("modul") && (textLower.includes("apa") || textLower.includes("mana") || textLower.includes("harus") || textLower.includes("pelajari")))
      ) {
        const userId = localStorage.getItem("userId");
        if (userId && window.displayRoadmap) {
          await window.displayRoadmap(userId);
        } else {
          if (window.addMessage) {
            window.addMessage("Silakan login dan selesaikan kuis terlebih dahulu untuk melihat roadmap pembelajaran kamu.", "bot");
          }
        }
        return;
      }

      let reply = null;
      let useAI = false;

      try {
        const datasetReply = getAnswerFromDicoding(text);
        console.log("Jawaban bot dari dataset:", datasetReply);

        // Check if dataset found a relevant answer (not a "not found" message)
        if (datasetReply && !datasetReply.includes("tidak menemukan") && !datasetReply.includes("belum bisa menjawab") && !datasetReply.includes("Belum ada deskripsi yang jelas di data")) {
          reply = datasetReply;
        } else {
          // Dataset didn't find relevant answer, use AI
          useAI = true;
          console.log("Dataset tidak menemukan jawaban yang relevan, menggunakan AI...");
        }
      } catch (err) {
        console.error("Error di getAnswerFromDicoding:", err);
        useAI = true; // Use AI fallback on error
      }

      // If no answer from dataset or need to use AI, call AI
      if (useAI || !reply) {
        console.log("Memanggil AI untuk menjawab pertanyaan...");

        // Show loading message
        if (window.addMessage) {
          window.addMessage("💭 Sedang memproses pertanyaanmu...", "bot");
        }

        // Get user context for AI
        const learningPath = localStorage.getItem("userLearningPath") || "";
        const userLevel = localStorage.getItem("userLevel") || "";
        const interestCategory = localStorage.getItem("userInterestCategory") || "";

        // Build context-aware prompt
        let aiPrompt = text;
        let contextInfo = "";

        if (learningPath) {
          contextInfo += `Learning path user: ${learningPath}. `;
        }
        if (userLevel) {
          contextInfo += `Level skill user: ${userLevel}. `;
        }
        if (interestCategory) {
          contextInfo += `Kategori interest: ${interestCategory}. `;
        }

        if (contextInfo) {
          aiPrompt = `Kamu adalah Learning Buddy, asisten belajar yang membantu user. ${contextInfo}User bertanya: "${text}"\n\nJawab dengan ramah, informatif, dan relevan. Jika pertanyaan tentang gaji, karir, atau hal umum, jawab dengan baik. Jika tentang materi belajar, fokus pada learning path mereka.\n\nFormat jawabanmu dengan rapi:\n- Gunakan **teks tebal** untuk poin penting\n- Gunakan nomor (1. 2. 3.) untuk list\n- Buat paragraf yang jelas dengan spasi antar paragraf`;
        } else {
          aiPrompt = `Kamu adalah Learning Buddy, asisten belajar. User bertanya: "${text}"\n\nJawab dengan ramah dan informatif.\n\nFormat jawabanmu dengan rapi:\n- Gunakan **teks tebal** untuk poin penting\n- Gunakan nomor (1. 2. 3.) untuk list\n- Buat paragraf yang jelas dengan spasi antar paragraf`;
        }

        try {
          const aiResponse = await fetch("http://localhost:5000/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: aiPrompt }),
            timeout: 30000, // 30 second timeout
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            let aiReply = aiData.reply || "Maaf, saya tidak bisa menjawab saat ini.";

            // Format AI reply to be more readable
            aiReply = formatAIResponse(aiReply);
            reply = aiReply;

            // Remove loading message and show AI reply
            const chatMessagesEl = document.getElementById("chat-messages");
            if (chatMessagesEl && chatMessagesEl.lastElementChild) {
              const lastMsg = chatMessagesEl.lastElementChild;
              if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Sedang memproses")) {
                lastMsg.remove();
              }
            }
          } else {
            const errorData = await aiResponse.json().catch(() => ({}));
            console.error("AI response error:", errorData);
            reply = errorData.error || "Maaf, terjadi kesalahan saat menghubungi AI. Pastikan OPENAI_API_KEY sudah di-set di backend.";

            // Remove loading message
            const chatMessagesEl = document.getElementById("chat-messages");
            if (chatMessagesEl && chatMessagesEl.lastElementChild) {
              const lastMsg = chatMessagesEl.lastElementChild;
              if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Sedang memproses")) {
                lastMsg.remove();
              }
            }
          }
        } catch (aiError) {
          console.error("AI error:", aiError);
          reply = "Maaf, terjadi kesalahan saat menghubungi AI. Pastikan:\n1. Backend server sudah running di port 5000\n2. OPENAI_API_KEY sudah di-set di file .env backend";

          // Remove loading message
          const chatMessagesEl = document.getElementById("chat-messages");
          if (chatMessagesEl && chatMessagesEl.lastElementChild) {
            const lastMsg = chatMessagesEl.lastElementChild;
            if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Sedang memproses")) {
              lastMsg.remove();
            }
          }
        }
      }

      if (window.addMessage && reply) {
        // Check if reply contains HTML (from AI formatting)
        const isHTML = reply.includes("<div") || reply.includes("<p") || reply.includes("<ul") || reply.includes("<li") || reply.includes("<strong");
        window.addMessage(reply, "bot", isHTML);
      }
    });
  } else {
    console.warn("Elemen chat belum lengkap (chat-form / chat-input / chat-messages tidak ditemukan).");
  }
});

function openChatbot() {
  if (!requireLoginForChat()) return;
  document.getElementById("landing").style.display = "none";
  document.getElementById("chatbot").style.display = "block";

  // Reset welcome flag when opening chatbot (in case user closes and reopens)
  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages && chatMessages.children.length === 0) {
    window.welcomeMessageShown = false;
  }

  // Check quiz status and show welcome message immediately when chatbot opens
  // Wait a bit longer to ensure DOM is ready
  setTimeout(() => {
    console.log("Checking for welcome message...");
    if (typeof window.checkQuizStatusAndWelcome === "function") {
      console.log("Calling checkQuizStatusAndWelcome...");
      window.checkQuizStatusAndWelcome();
    } else {
      console.log("checkQuizStatusAndWelcome not found, using fallback");
      // Fallback: show simple welcome if function not ready
      if (chatMessages && chatMessages.children.length === 0 && !window.welcomeMessageShown) {
        if (window.addMessage) {
          window.addMessage("Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis! 😊", "bot");
          window.welcomeMessageShown = true;
        } else {
          console.error("addMessage function not found!");
        }
      }
    }
  }, 500);
}

// Verify functions are defined at the end of script
(function () {
  console.log("=== Script.js Loaded ===");
  console.log("checkQuizStatusAndWelcome type:", typeof window.checkQuizStatusAndWelcome);
  console.log("addMessage type:", typeof window.addMessage);
  console.log("openChatbot type:", typeof openChatbot);

  if (typeof window.checkQuizStatusAndWelcome !== "function") {
    console.error("ERROR: checkQuizStatusAndWelcome is not a function!");
  }
})();

// Setup event listeners when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startChatBtn");
    const chatIcon = document.getElementById("chatIcon");
    if (startBtn) startBtn.onclick = openChatbot;
    if (chatIcon) chatIcon.onclick = openChatbot;
  });
} else {
  // DOM already loaded
  const startBtn = document.getElementById("startChatBtn");
  const chatIcon = document.getElementById("chatIcon");
  if (startBtn) startBtn.onclick = openChatbot;
  if (chatIcon) chatIcon.onclick = openChatbot;
}
