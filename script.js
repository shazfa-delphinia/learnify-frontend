window.LEARNIFY_CHAT_OVERRIDE = true;

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
    const [learningPaths, courses, courseLevels, tutorials] = await Promise.all([
      fetchDicoding(API_URL_learning_paths),
      fetchDicoding(API_URL_courses),
      fetchDicoding(API_URL_course_levels),
      fetchDicoding(API_URL_tutorials),
    ]);

    console.log("LEARNING PATHS:", learningPaths);
    console.log("COURSES:", courses);
    console.log("COURSE LEVELS:", courseLevels);
    console.log("TUTORIALS:", tutorials);

    dbLearningPaths = learningPaths;
    dbCourses = courses;
    dbCourseLevels = courseLevels;
    dbTutorials = tutorials;

    // Bangun knowledge base
    knowledgeBase = [];

    dbLearningPaths.forEach((lp) => {
      knowledgeBase.push({
        type: "learning_path",
        title: lp.learning_path_name || lp.title || "",
        description: lp.learning_path_description || lp.description || lp.short_description || "",
        raw: lp,
      });
    });

    dbCourses.forEach((c) => {
      knowledgeBase.push({
        type: "course",
        title: c.course_name || c.title || "",
        description: c.course_description || c.description || c.short_description || "",
        raw: c,
      });
    });

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
  if (u.includes(t)) return 1.0;

  const uWords = new Set(u.split(" ").filter(Boolean));
  const tWords = t.split(" ").filter(Boolean);
  if (!tWords.length) return 0;

  let matchCount = 0;
  tWords.forEach((w) => {
    if (uWords.has(w)) matchCount++;
  });

  return matchCount / tWords.length;
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

  if (!bestItem || bestScore < 0.25) {
    return "Maaf, aku tidak menemukan materi yang pas. Coba gunakan nama course atau learning path yang lebih spesifik ya 😊";
  }

  const title = bestItem.title || "(tanpa judul)";
  const desc =
    bestItem.description && bestItem.description.trim().length > 0
      ? bestItem.description
      : "Belum ada deskripsi yang jelas di data.";

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
  let formatted = String(text);

  formatted = formatted.replace(
    /\*\*(.+?)\*\*/g,
    '<strong style="color: #ffffff; font-weight: 600;">$1</strong>'
  );

  const sections = formatted.split(/\n\n+/);
  const processedSections = [];
  let currentList = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;

    const listMatch = section.match(/^(\d+)\.\s+(.+)$/s);

    if (listMatch) {
      const num = listMatch[1];
      let content = listMatch[2].trim();
      content = content.replace(/\n/g, "<br>");

      currentList.push(
        `<li style="margin: 10px 0; padding-left: 5px; line-height: 1.7; color: #ffffff;"><strong style="color: #ffffff; font-weight: 600;">${num}.</strong> ${content}</li>`
      );
    } else {
      if (currentList.length > 0) {
        processedSections.push(
          `<ul style="margin: 12px 0; padding-left: 20px; list-style: none;">${currentList.join(
            ""
          )}</ul>`
        );
        currentList = [];
      }

      const paraContent = section.replace(/\n/g, "<br>");
      processedSections.push(
        `<p style="margin: 12px 0; line-height: 1.8; color: #ffffff;">${paraContent}</p>`
      );
    }
  }

  if (currentList.length > 0) {
    processedSections.push(
      `<ul style="margin: 12px 0; padding-left: 20px; list-style: none;">${currentList.join(
        ""
      )}</ul>`
    );
  }

  formatted = processedSections.join("");
  formatted = `<div style="color: #ffffff; line-height: 1.7;">${formatted}</div>`;
  return formatted;
}

// =====================================
// ROADMAP FUNCTIONS
// =====================================

async function getUserRoadmap(userId) {
  try {
    const response = await fetch(`${NODE_API_URL}/user/${userId}/roadmap`);
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

async function getUserProgress(userId) {
  try {
    const response = await fetch(`${NODE_API_URL}/user/${userId}/progress`);
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

function formatRoadmapHTML(roadmap, progress = []) {
  if (!roadmap || !roadmap.learning_path) {
    return '<p style="color: #ffffff;">Roadmap belum tersedia. Silakan selesaikan kuis terlebih dahulu.</p>';
  }

  const lp = roadmap.learning_path;
  const courses = lp.course || [];
  const lpName = resolveLearningPathName(lp, roadmap) || "N/A";
  const lpSummary = lp.summary || lp.learning_path_description || lp.description;
  const lpUrlRaw =
    mapLearningPathToUrl(lpName) ||
    `https://www.dicoding.com/search?keyword=${encodeURIComponent(lpName)}`;
  const lpUrl = lpUrlRaw.replace(/"/g, "&quot;");

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
        ${
          lpSummary
            ? `<p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">${lpSummary}</p>`
            : ""
        }
        <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.75); font-size: 12px;">Klik untuk membuka halaman learning path di Dicoding.</p>
      </div>
      
      <div style="margin-top: 16px;">
        <h4 style="margin: 0 0 12px 0; color: #ffffff; font-size: 18px; font-weight: 600;">📚 Modul Pembelajaran</h4>
  `;

  const sortedCourses = [...courses].sort(
    (a, b) => (a.course_order || 0) - (b.course_order || 0)
  );

  sortedCourses.forEach((course, courseIdx) => {
    const courseName = course.course_name || "Course";
    const courseLinkRaw =
      course.course_url || course.url || course.link || course.course_link || course.external_url;
    const lpUrl = mapLearningPathToUrl(lpName);
    const courseLink =
      courseLinkRaw ||
      lpUrl ||
      `https://www.dicoding.com/search?keyword=${encodeURIComponent(courseName)}`;
    const safeCourseLink = courseLink.replace(/"/g, "&quot;");
    const courseProgress = progressMap[course.id] || {};
    const tutorials = course.tutorials || [];
    const sortedTutorials = [...tutorials].sort(
      (a, b) => (a.tutorial_order || 0) - (b.tutorial_order || 0)
    );

    let completedTutorials = 0;
    let totalTutorials = sortedTutorials.length;
    sortedTutorials.forEach((tutorial) => {
      const tutProgress = courseProgress[tutorial.id];
      if (tutProgress && tutProgress.status === "completed") {
        completedTutorials++;
      }
    });
    const courseCompletion =
      totalTutorials > 0 ? Math.round((completedTutorials / totalTutorials) * 100) : 0;

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
      <div onclick="window.open('${safeCourseLink}', '_blank')" style="background: rgba(255, 255, 255, 0.08); padding: 16px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid ${
        courseCompletion === 100 ? "#4caf50" : courseCompletion > 0 ? "#ff9800" : "#2196f3"
      }; cursor: pointer; transition: transform 0.1s ease, box-shadow 0.1s ease;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 12px rgba(0,0,0,0.18)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none';">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div style="flex: 1;">
            <h5 style="margin: 0 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
              ${courseIdx + 1}. ${courseName}
            </h5>
            ${
              course.level
                ? `<span style="color: rgba(255, 255, 255, 0.7); font-size: 13px;">Level: ${course.level}</span>`
                : ""
            }
            ${
              course.hours_to_study
                ? `<span style="color: rgba(255, 255, 255, 0.7); font-size: 13px; margin-left: 8px;">⏱️ ${course.hours_to_study} jam</span>`
                : ""
            }
          </div>
          <div style="text-align: right;">
            <span style="color: #ffffff; font-size: 14px; font-weight: 600;">${statusIcon} ${statusText}</span>
            ${
              totalTutorials > 0
                ? `<div style="color: rgba(255, 255, 255, 0.8); font-size: 12px; margin-top: 4px;">${completedTutorials}/${totalTutorials} tutorial</div>`
                : ""
            }
          </div>
        </div>
        
        ${
          courseCompletion > 0
            ? `
          <div style="background: rgba(0, 0, 0, 0.2); border-radius: 8px; height: 8px; margin: 8px 0; overflow: hidden;">
            <div style="background: ${
              courseCompletion === 100 ? "#4caf50" : "#ff9800"
            }; height: 100%; width: ${courseCompletion}%; transition: width 0.3s ease;"></div>
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
                const tutColor = isCompleted
                  ? "rgba(76, 175, 80, 0.9)"
                  : isInProgress
                  ? "rgba(255, 152, 0, 0.9)"
                  : "rgba(255, 255, 255, 0.6)";

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

async function displayRoadmap(userId = null) {
  const actualUserId = userId || localStorage.getItem("userId");

  if (!actualUserId) {
    if (window.addMessage) {
      window.addMessage("Silakan login terlebih dahulu untuk melihat roadmap.", "bot");
    }
    return;
  }

  if (window.addMessage) {
    window.addMessage("📋 Memuat roadmap kamu...", "bot");
  }

  try {
    const storedLpName = (localStorage.getItem("userLearningPath") || "").toLowerCase();

    let [roadmap, progress] = await Promise.all([
      getUserRoadmap(actualUserId),
      getUserProgress(actualUserId),
    ]);

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

    if (staticRoadmapData) {
      const preferredLpName =
        storedLpName ||
        (roadmap ? resolveLearningPathName(roadmap.learning_path, roadmap) : "");
      if (preferredLpName) {
        const staticRoadmap = buildRoadmapFromStatic(
          preferredLpName,
          (roadmap && roadmap.user_level) ||
            localStorage.getItem("userLevel") ||
            "beginner"
        );
        if (staticRoadmap) {
          roadmap = staticRoadmap;
        }
      }
    }

    if (!roadmap) {
      console.log("Backend tidak mengembalikan roadmap, mencoba buildRoadmapFromLocalData() ...");
      roadmap = buildRoadmapFromLocalData();
    }

    const chatMessagesEl = document.getElementById("chat-messages");
    if (chatMessagesEl && chatMessagesEl.lastElementChild) {
      const lastMsg = chatMessagesEl.lastElementChild;
      if (lastMsg && lastMsg.textContent && lastMsg.textContent.includes("Memuat roadmap")) {
        lastMsg.remove();
      }
    }

    if (!roadmap) {
      if (window.addMessage) {
        window.addMessage(
          "Roadmap belum tersedia. Silakan selesaikan kuis terlebih dahulu untuk mendapatkan roadmap pembelajaran kamu.",
          "bot"
        );
      }
      return;
    }

    const roadmapHTML = formatRoadmapHTML(roadmap, progress || []);

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
      window.addMessage(
        "Maaf, terjadi kesalahan saat memuat roadmap. Silakan coba lagi nanti.",
        "bot"
      );
    }
  }
}

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

window.addMessage = addMessageCore;

window.saveChatHistory = function () {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return;

  const userId = localStorage.getItem("userId");

  const messages = [];
  chatMessagesEl.querySelectorAll(".bubble").forEach((bubble) => {
    const role = bubble.classList.contains("bubble-user") ? "user" : "bot";
    const isHTML = bubble.innerHTML !== bubble.textContent;
    const content = isHTML ? bubble.innerHTML : bubble.textContent;

    if (
      content.includes("start-quiz-welcome-btn") ||
      content.includes("continue-tech-quiz-btn")
    ) {
      return;
    }

    messages.push({ role, content, isHTML });
  });

  const key = userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST;
  localStorage.setItem(key, JSON.stringify(messages));
};

window.loadChatHistory = function () {
  const chatMessagesEl = document.getElementById("chat-messages");
  if (!chatMessagesEl) return false;

  const userId = localStorage.getItem("userId");
  const savedHistory = localStorage.getItem(
    userId ? `${CHAT_HISTORY_PREFIX}${userId}` : CHAT_HISTORY_GUEST
  );
  if (!savedHistory) return false;

  try {
    const messages = JSON.parse(savedHistory);
    if (messages.length === 0) return false;

    chatMessagesEl.innerHTML = "";

    isRestoringHistory = true;
    messages.forEach((msg) => {
      addMessageCore(
        msg.content || msg.text || "",
        msg.role === "user" ? "user" : "bot",
        !!msg.isHTML,
        { skipPersist: true }
      );
    });
    isRestoringHistory = false;

    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return true;
  } catch (error) {
    console.error("Error loading chat history:", error);
    return false;
  }
};

window.welcomeMessageShown = false;

window.checkQuizStatusAndWelcome = async function () {
  console.log("checkQuizStatusAndWelcome called");

  if (window.welcomeMessageShown) {
    console.log("Welcome message already shown, skipping...");
    return;
  }

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

  const historyLoaded = window.loadChatHistory ? window.loadChatHistory() : false;
  const hasMessages = chatMessages.children.length > 0;

  if (hasMessages || historyLoaded) {
    console.log("Messages already exist or history loaded, skipping welcome");
    window.welcomeMessageShown = true;
    return;
  }

  console.log("No messages found, showing welcome...");
  window.welcomeMessageShown = true;

  const userId = localStorage.getItem("userId");
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  console.log("User status:", { userId, isLoggedIn, addMessageExists: typeof window.addMessage });

  if (!isLoggedIn || !userId) {
    console.log("User not logged in, showing basic welcome");
    if (window.addMessage) {
      window.addMessage(
        "Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis, atau tanyakan sesuatu tentang materi belajar! 😊",
        "bot"
      );
    }
    return;
  }

  console.log("User is logged in, checking quiz result...");
  try {
    const response = await fetch(`${NODE_API_URL}/user/${userId}/has-quiz-result`);
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
        window.addMessage(welcomeHTML, "bot", true);
      }

      setTimeout(() => {
        const btn = document.querySelector(".start-quiz-welcome-btn");
        if (btn) {
          btn.addEventListener("click", () => {
            if (window.showQuizOptions) {
              window.showQuizOptions();
            }
          });
        }
      }, 100);
    } else {
      console.log("User already has quiz result, showing welcome back message");

      const learningPath =
        data.learningPath || localStorage.getItem("userLearningPath") || "";
      const userLevel = data.userLevel || localStorage.getItem("userLevel") || "";

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
        window.addMessage(welcomeMessage, "bot", true);
      }
    }
  } catch (error) {
    console.error("Check quiz status error:", error);
    if (window.addMessage) {
      window.addMessage(
        "Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis, atau tanyakan sesuatu tentang materi belajar! 😊",
        "bot"
      );
    }
  }
};

// =====================================
// 3. UI: SIDEBAR + CHATBOT
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  loadAllData();

  const sidebar = document.querySelector(".sidebar");
  const toggleBtn = document.querySelector(".list-icon");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("minimized");
    });
  }

  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const chatMessages = document.getElementById("chat-messages");

  // ===============================
// CHAT FORM HANDLER (UI ONLY)
// ===============================
if (chatForm && chatInput && chatMessages) {
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!requireLoginForChat(e)) return;
        // seluruh logika chat pindah ke chat.js
    });
} else {
    console.warn("Chat elements not found.");
}

  window.addMessage = (text, role = "user", isHTML = false, options = {}) =>
    addMessageCore(text, role, isHTML, options);

  restoreChatHistory();

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(
      ".quiz-btn, .start-quiz-welcome-btn, #chat-form button, #chat-input, .chat-btn, [data-open-chatbot]"
    );
    if (!trigger) return;
    requireLoginForChat(e);
  });

  window.showQuizOptions = async function () {
    if (window.addMessage) {
      window.addMessage(
        "Halo! Saya bisa membantu kamu menemukan learning path yang tepat dengan kuis. Pilih jenis kuis yang ingin kamu ikuti:",
        "bot"
      );
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

  window.quizAnswers = {
    interest: [],
    tech: {},
  };

  window.startQuiz = async function (quizType) {
    try {
      if (window.addMessage) {
        window.addMessage(
          `Memuat kuis ${quizType === "interest" ? "Interest" : "Technical"}...`,
          "bot"
        );
      }

      let endpoint = `${NODE_API_URL}/quiz/csv/interest/questions`;

      if (quizType === "tech") {
        const storedLp =
          localStorage.getItem("userLearningPath") || window.currentLearningPath || "";
        const techCategory = mapLearningPathToTechCategory(storedLp);

        if (techCategory) {
          endpoint = `${NODE_API_URL}/quiz/csv/tech/questions?tech_category=${encodeURIComponent(
            techCategory
          )}`;
          if (window.addMessage) {
            window.addMessage(
              `Menyiapkan soal technical untuk learning path: ${storedLp} (kategori: ${techCategory}).`,
              "bot"
            );
          }
        } else {
          endpoint = `${NODE_API_URL}/quiz/csv/tech/questions`;
          if (window.addMessage && storedLp) {
            window.addMessage(
              `Learning path "${storedLp}" belum punya kategori khusus, menampilkan soal technical campuran.`,
              "bot"
            );
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
          window.addMessage(
            "Soal technical untuk learning path kamu belum tersedia. Menampilkan soal campuran sebagai gantinya.",
            "bot"
          );
        }
        const fallbackResponse = await fetch(
          `${NODE_API_URL}/quiz/csv/tech/questions`
        );
        const fallbackData = await fallbackResponse.json();
        data.questions = fallbackData.questions || [];
      }

      if (!window.quizAnswers) {
        window.quizAnswers = {
          interest: [],
          tech: {},
        };
      }

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
        window.addMessage(
          `Maaf, terjadi kesalahan: ${error.message}. Pastikan backend server sudah running.`,
          "bot"
        );
      }
    }
  };

  function displayQuestion(index) {
    const quiz = window.currentQuiz;
    if (!quiz || index >= quiz.questions.length) {
      finishQuiz();
      return;
    }

    if (quiz.lastDisplayedIndex === index) {
      console.log("Question already displayed, skipping...");
      return;
    }
    quiz.lastDisplayedIndex = index;

    const question = quiz.questions[index];
    let questionHTML = `
      <div style="margin-bottom: 20px;">
        <div style="margin-bottom: 12px; font-size: 14px; color: rgba(255, 255, 255, 0.9);"><strong>Pertanyaan ${
          index + 1
        }/${quiz.questions.length}</strong></div>
        <div style="margin-bottom: 18px; font-weight: 500; font-size: 16px; line-height: 1.5;">${
          question.question_text
        }</div>
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

    setTimeout(() => {
      document.querySelectorAll(".option-btn").forEach((btn) => {
        if (btn.dataset.listenerAdded === "true") {
          return;
        }
        btn.dataset.listenerAdded = "true";

        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          if (this.disabled) return;

          const qIndex = parseInt(this.dataset.index);
          const optIndex = parseInt(this.dataset.option);
          selectAnswer(qIndex, optIndex);
        });

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

  function selectAnswer(questionIndex, optionIndex) {
    const quiz = window.currentQuiz;
    if (!quiz) return;

    if (quiz.currentIndex !== questionIndex) {
      console.log("Question index mismatch, ignoring click");
      return;
    }

    const question = quiz.questions[questionIndex];
    const selectedOption = question.options[optionIndex];

    document.querySelectorAll(".option-btn").forEach((btn) => {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    });

    if (quiz.type === "interest") {
      quiz.answers.push(selectedOption.option_text || selectedOption.text);
    } else {
      const questionText = question.question_text;
      quiz.answers[questionText] = selectedOption.text || selectedOption.option_text;
    }

    if (!window.quizAnswers) {
      window.quizAnswers = {
        interest: [],
        tech: {},
      };
    }

    if (quiz.type === "interest") {
      window.quizAnswers.interest.push(
        selectedOption.option_text || selectedOption.text
      );
    } else {
      const questionText = question.question_text;
      window.quizAnswers.tech[questionText] =
        selectedOption.text || selectedOption.option_text;
    }

    if (window.addMessage) {
      window.addMessage(
        `Jawaban: ${selectedOption.option_text || selectedOption.text}`,
        "user"
      );
    }

    quiz.currentIndex = questionIndex + 1;

    if (quiz.currentIndex < quiz.questions.length) {
      setTimeout(() => displayQuestion(quiz.currentIndex), 500);
    } else {
      finishQuiz();
    }
  }

  async function finishQuiz() {
    const quiz = window.currentQuiz;
    if (!quiz) return;

    if (window.addMessage) {
      window.addMessage(
        "Terima kasih! Saya sedang memproses jawabanmu untuk menentukan learning path terbaik...",
        "bot"
      );
    }

    try {
      const userId = localStorage.getItem("userId");

      const requestBody = {
        user_interest_answers: (window.quizAnswers && window.quizAnswers.interest) || [],
        user_tech_answers_mcq: (window.quizAnswers && window.quizAnswers.tech) || {},
        student_id: userId || null,
      };

      const response = await fetch(`${ML_API_URL}/predict`, {
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

      const hasInterest =
        window.quizAnswers &&
        window.quizAnswers.interest &&
        window.quizAnswers.interest.length > 0;
      const hasTech =
        window.quizAnswers &&
        window.quizAnswers.tech &&
        Object.keys(window.quizAnswers.tech).length > 0;
      const isOnlyInterest = hasInterest && !hasTech && quiz.type === "interest";

      let roadmapSaved = false;
      if (userId && result.chosen_learning_path && (hasTech || !isOnlyInterest)) {
        try {
          console.log("Saving roadmap to database...", {
            user_id: userId,
            learning_path_name: result.chosen_learning_path,
            user_level: result.detected_level || "beginner",
          });

          const saveResponse = await fetch(`${NODE_API_URL}/user/roadmap/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: userId,
              learning_path_name: result.chosen_learning_path,
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

            if (window.addMessage) {
              window.addMessage(
                `⚠️ Roadmap tidak bisa disimpan ke database: ${
                  errorData.error || errorData.note || "Learning path tidak ditemukan"
                }. Roadmap tetap akan ditampilkan dari hasil kuis.`,
                "bot"
              );
            }
          }

          localStorage.setItem("userLearningPath", result.chosen_learning_path || "");
          localStorage.setItem("userLevel", result.detected_level || "beginner");
          if (result.interest_category) {
            localStorage.setItem("userInterestCategory", result.interest_category);
          }
        } catch (saveError) {
          console.error("Error saving roadmap:", saveError);
          localStorage.setItem("userLearningPath", result.chosen_learning_path || "");
          localStorage.setItem("userLevel", result.detected_level || "beginner");
          if (result.interest_category) {
            localStorage.setItem("userInterestCategory", result.interest_category);
          }
        }
      }

      let resultHTML = "";

      if (isOnlyInterest) {
        resultHTML = `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-top: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.15);">
            <h3 style="margin-top: 0; color: white; font-size: 20px;">🎯 Learning Path Kamu</h3>
            <p style="font-size: 18px; margin: 15px 0; color: white; font-weight: bold;">${
              result.chosen_learning_path || "Belum ditentukan"
            }</p>
            ${
              result.interest_category
                ? `<p style="margin-bottom: 0; color: rgba(255,255,255,0.9);">Kategori: ${result.interest_category}</p>`
                : ""
            }
          </div>
        `;
      } else {
        resultHTML = `
          <div style="background: #ffffff; padding: 20px; border-radius: 12px; margin-top: 10px; border: 2px solid #23436a; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <h3 style="margin-top: 0; color: #23436a; font-size: 20px;">📊 Hasil Kuis Lengkap</h3>
            <div style="color: #000000; line-height: 1.8;">
              <p style="margin: 12px 0;"><strong style="color: #23436a;">Learning Path yang Direkomendasikan:</strong><br><span style="color: #000000; font-size: 16px;">${
                result.chosen_learning_path || "Belum ditentukan"
              }</span></p>
              ${
                result.detected_level
                  ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Level Skill:</strong><br><span style="color: #000000;">${result.detected_level}</span></p>`
                  : ""
              }
              ${
                result.interest_category
                  ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Kategori Interest:</strong><br><span style="color: #000000;">${result.interest_category}</span></p>`
                  : ""
              }
              ${
                result.tech_percent_correct !== undefined
                  ? `<p style="margin: 12px 0;"><strong style="color: #23436a;">Skor Technical:</strong><br><span style="color: #000000; font-size: 18px; font-weight: bold;">${result.tech_percent_correct.toFixed(
                      1
                    )}%</span></p>`
                  : ""
              }
            </div>
          </div>
        `;
      }

      if (window.addMessage) {
        window.addMessage(resultHTML, "bot", true);
      }

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

          setTimeout(() => {
            const continueBtn = document.querySelector(".continue-tech-quiz-btn");

            if (continueBtn) {
              continueBtn.addEventListener("click", () => {
                if (window.startQuiz) {
                  window.startQuiz("tech");
                }
              });

              continueBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }, 100);
        }, 1000);

        window.currentQuiz = null;
      } else {
        const completionHTML = `
          <div style="margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32; font-weight: bold; font-size: 16px;">✅ Hasil kuismu sudah tersimpan!</p>
            <p style="margin: 8px 0 0 0; color: #1b5e20;">Sekarang kamu bisa bertanya tentang materi belajar atau learning path kamu.</p>
          </div>
        `;

        if (window.addMessage) {
          window.addMessage(completionHTML, "bot", true);
        }

        setTimeout(async () => {
          if (userId && window.displayRoadmap) {
            let retries = 3;
            let roadmapDisplayed = false;

            while (retries > 0 && !roadmapDisplayed) {
              console.log(
                `Attempting to display roadmap (retry ${4 - retries}/3)...`
              );
              await window.displayRoadmap(userId);

              await new Promise((resolve) => setTimeout(resolve, 1000));

              const chatMessagesEl = document.getElementById("chat-messages");
              if (chatMessagesEl && chatMessagesEl.lastElementChild) {
                const lastMsg = chatMessagesEl.lastElementChild;
                const lastText = lastMsg.textContent || "";
                const lastHTML = lastMsg.innerHTML || "";

                if (
                  lastText.includes("Roadmap belum tersedia") ||
                  lastText.includes("Memuat roadmap")
                ) {
                  if (retries > 1) {
                    console.log("Roadmap not found, retrying...");
                    lastMsg.remove();
                    await new Promise((resolve) => setTimeout(resolve, 1500));
                  }
                } else if (
                  lastHTML.includes("Roadmap Pembelajaran") ||
                  lastHTML.includes("Modul Pembelajaran")
                ) {
                  console.log("Roadmap displayed successfully");
                  roadmapDisplayed = true;
                } else {
                  roadmapDisplayed = true;
                }
              } else {
                roadmapDisplayed = true;
              }

              retries--;
            }
          }
        }, 2500);

        window.currentQuiz = null;
        window.quizAnswers = {
          interest: [],
          tech: {},
        };
      }
    } catch (error) {
      console.error("ML prediction error:", error);
      let errorMessage = `Maaf, terjadi kesalahan saat memproses hasil: ${error.message}`;

      if (
        error.message.includes("fetch") ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        errorMessage =
          "Maaf, tidak dapat terhubung ke server. Pastikan backend server dan ML server sudah berjalan.";
      }

      if (window.addMessage) {
        window.addMessage(errorMessage, "bot");
      }
    }
  }

function openChatbot() {
  if (!requireLoginForChat()) return;
  document.getElementById("landing").style.display = "none";
  document.getElementById("chatbot").style.display = "block";

  const chatMessages = document.getElementById("chat-messages");
  if (chatMessages && chatMessages.children.length === 0) {
    window.welcomeMessageShown = false;
  }

  setTimeout(() => {
    console.log("Checking for welcome message...");
    if (typeof window.checkQuizStatusAndWelcome === "function") {
      console.log("Calling checkQuizStatusAndWelcome...");
      window.checkQuizStatusAndWelcome();
    } else {
      console.log("checkQuizStatusAndWelcome not found, using fallback");
      if (chatMessages && chatMessages.children.length === 0 && !window.welcomeMessageShown) {
        if (window.addMessage) {
          window.addMessage(
            "Halo! Saya Learning Buddy. Saya bisa membantu kamu menemukan learning path yang tepat. Ketik 'kuis' untuk memulai kuis! 😊",
            "bot"
          );
          window.welcomeMessageShown = true;
        } else {
          console.error("addMessage function not found!");
        }
      }
    }
  }, 500);
}

(function () {
  console.log("=== Script.js Loaded ===");
  console.log(
    "checkQuizStatusAndWelcome type:",
    typeof window.checkQuizStatusAndWelcome
  );
  console.log("addMessage type:", typeof window.addMessage);
  console.log("openChatbot type:", typeof openChatbot);

  if (typeof window.checkQuizStatusAndWelcome !== "function") {
    console.error("ERROR: checkQuizStatusAndWelcome is not a function!");
  }
  });
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startChatBtn");
    const chatIcon = document.getElementById("chatIcon");
    if (startBtn) startBtn.onclick = openChatbot;
    if (chatIcon) chatIcon.onclick = openChatbot;
  });
} else {
  const startBtn = document.getElementById("startChatBtn");
  const chatIcon = document.getElementById("chatIcon");
  if (startBtn) startBtn.onclick = openChatbot;
  if (chatIcon) chatIcon.onclick = openChatbot;
}