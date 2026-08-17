/* =========================================================
   StudyRank
   GitHub Pages + Supabase
   ========================================================= */

/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
  "https://yzlmzgkbrpugukzqbbie.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_pYwcnBryBcOtCiK5RERs_g_mf_HHRU_";

const { createClient } = window.supabase;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentUser = null;
let currentProfile = null;

let subjects = [];
let todos = [];

let currentSession = null;

let selectedSubjectId = null;
let editingSubjectId = null;
let editingTodoId = null;

let selectedColor = "#6366f1";

let timerInterval = null;

let currentTodoFilter = "all";
let currentRankingPeriod = "today";

let toastTimeout = null;


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  bindEvents();

  try {

    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();

    if (session?.user) {

      currentUser = session.user;

      await startApp();

    } else {

      showAuth();

    }

  } catch (error) {

    console.error(error);

    showAuth();

    toast("앱을 불러오는 중 문제가 발생했습니다.");

  }

});


/* =========================================================
   AUTH SCREEN
   ========================================================= */

function showAuth() {

  const auth = $("#auth-screen");
  const app = $("#app-screen");

  if (auth) {
    auth.classList.remove("hidden");
  }

  if (app) {
    app.classList.add("hidden");
  }

}


function showApp() {

  const auth = $("#auth-screen");
  const app = $("#app-screen");

  if (auth) {
    auth.classList.add("hidden");
  }

  if (app) {
    app.classList.remove("hidden");
  }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

  const email =
    $("#login-email")?.value.trim();

  const password =
    $("#login-password")?.value || "";

  if (!email || !password) {

    toast("이메일과 비밀번호를 입력해주세요.");

    return;

  }

  const button = $("#login-btn");

  if (button) {

    button.disabled = true;
    button.textContent = "로그인 중...";

  }

  try {

    const {
      data,
      error
    } = await supabase.auth.signInWithPassword({

      email,
      password

    });

    if (error) {

      console.error(error);

      toast(getSupabaseErrorMessage(error));

      return;

    }

    currentUser = data.user;

    await startApp();

  } catch (error) {

    console.error(error);

    toast("로그인 중 오류가 발생했습니다.");

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "로그인";

    }

  }

}


/* =========================================================
   SIGNUP
   ========================================================= */

async function signup() {

  const name =
    $("#signup-name")?.value.trim();

  const email =
    $("#signup-email")?.value.trim();

  const password =
    $("#signup-password")?.value || "";

  const school =
    $("#signup-school")?.value.trim();

  const grade =
    Number($("#signup-grade")?.value);

  const classNumber =
    Number($("#signup-class")?.value);

  if (
    !name ||
    !email ||
    !password ||
    !school ||
    !grade ||
    !classNumber
  ) {

    toast("모든 정보를 입력해주세요.");

    return;

  }

  if (password.length < 6) {

    toast("비밀번호는 6자 이상이어야 합니다.");

    return;

  }

  if (grade < 1 || grade > 12) {

    toast("학년을 올바르게 선택해주세요.");

    return;

  }

  if (classNumber < 1 || classNumber > 100) {

    toast("반을 1~100 사이로 입력해주세요.");

    return;

  }

  const button = $("#signup-btn");

  if (button) {

    button.disabled = true;
    button.textContent = "가입 중...";

  }

  try {

    const {
      data,
      error
    } = await supabase.auth.signUp({

      email,
      password,

      options: {

        data: {

          name,
          school,
          grade,
          class_number: classNumber

        }

      }

    });

    if (error) {

      console.error(error);

      toast(getSupabaseErrorMessage(error));

      return;

    }

    if (!data?.user) {

      toast("회원가입에 실패했습니다.");

      return;

    }

    /*
     * Supabase에서 이메일 인증이 켜져 있으면
     * 회원가입 직후 session이 없을 수 있습니다.
     */

    if (!data.session) {

      toast(
        "가입되었습니다. 이메일 인증 후 로그인해주세요."
      );

      showLoginForm();

      return;

    }

    currentUser = data.user;

    await createProfileIfNeeded({

      id: data.user.id,

      name,
      school,
      grade,
      class_number: classNumber

    });

    await createDefaultSubjects();

    await startApp();

  } catch (error) {

    console.error(error);

    toast("회원가입 중 오류가 발생했습니다.");

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "회원가입";

    }

  }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

  try {

    await supabase.auth.signOut();

  } catch (error) {

    console.error(error);

  }

  currentUser = null;
  currentProfile = null;

  subjects = [];
  todos = [];

  currentSession = null;

  selectedSubjectId = null;

  stopLocalTimer();

  showAuth();

}


/* =========================================================
   PROFILE
   ========================================================= */

async function createProfileIfNeeded(profileData = null) {

  if (!currentUser && !profileData) {
    return null;
  }

  const userId =
    profileData?.id || currentUser?.id;

  if (!userId) {
    return null;
  }

  try {

    const {
      data: existing,
      error: selectError
    } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {

      console.error(
        "프로필 조회 오류:",
        selectError
      );

      return null;

    }

    if (existing) {

      currentProfile = existing;

      return existing;

    }

    if (!profileData) {

      const metadata =
        currentUser?.user_metadata || {};

      profileData = {

        id: userId,

        name:
          metadata.name ||
          currentUser?.email?.split("@")[0] ||
          "사용자",

        school:
          metadata.school || "",

        grade:
          Number(metadata.grade) || 1,

        class_number:
          Number(metadata.class_number) || 1

      };

    }

    /*
     * DB의 profiles 구조에 맞춰 저장
     */

    const {
      data,
      error
    } = await supabase
      .from("profiles")
      .insert({

        id: profileData.id,

        name: profileData.name || "사용자",

        school: profileData.school || "",

        grade:
          Number(profileData.grade) || 1,

        class_number:
          Number(profileData.class_number) || 1

      })
      .select()
      .single();

    if (error) {

      /*
       * 동시에 프로필이 만들어진 경우
       * 다시 조회합니다.
       */

      console.error(
        "프로필 생성 오류:",
        error
      );

      const {
        data: retry
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (retry) {

        currentProfile = retry;

        return retry;

      }

      toast(
        "프로필 생성 중 오류가 발생했습니다."
      );

      return null;

    }

    currentProfile = data;

    return data;

  } catch (error) {

    console.error(error);

    return null;

  }

}


async function loadProfile() {

  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {

    console.error(error);

    return;

  }

  currentProfile = data;

  if (!data) {
    return;
  }

  if ($("#top-user-name")) {

    $("#top-user-name").textContent =
      data.name || "";

  }

  if ($("#home-greeting")) {

    $("#home-greeting").textContent =
      `${data.name || "사용자"}님, 안녕하세요 👋`;

  }

  if ($("#profile-name")) {

    $("#profile-name").value =
      data.name || "";

  }

  if ($("#profile-school")) {

    $("#profile-school").value =
      data.school || "";

  }

  if ($("#profile-grade")) {

    $("#profile-grade").value =
      data.grade || "";

  }

  if ($("#profile-class")) {

    $("#profile-class").value =
      data.class_number || "";

  }

  if ($("#ranking-class-info")) {

    $("#ranking-class-info").textContent =
      `${data.school || ""} ${data.grade || ""}학년 ${data.class_number || ""}반`;

  }

}


async function saveProfile() {

  if (!currentUser) {
    return;
  }

  const name =
    $("#profile-name")?.value.trim();

  const school =
    $("#profile-school")?.value.trim();

  const grade =
    Number($("#profile-grade")?.value);

  const classNumber =
    Number($("#profile-class")?.value);

  if (
    !name ||
    !school ||
    !grade ||
    !classNumber
  ) {

    toast("모든 정보를 입력해주세요.");

    return;

  }

  if (grade < 1 || grade > 12) {

    toast("학년을 올바르게 입력해주세요.");

    return;

  }

  if (classNumber < 1 || classNumber > 100) {

    toast("반을 1~100 사이로 입력해주세요.");

    return;

  }

  const button =
    $("#save-profile-btn");

  if (button) {

    button.disabled = true;
    button.textContent = "저장 중...";

  }

  try {

    const {
      data,
      error
    } = await supabase
      .from("profiles")
      .update({

        name,
        school,
        grade,
        class_number: classNumber

      })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) {

      console.error(error);

      toast(getSupabaseErrorMessage(error));

      return;

    }

    currentProfile = data;

    await loadProfile();
    await loadRanking();

    toast("정보가 저장되었습니다.");

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "정보 저장";

    }

  }

}


/* =========================================================
   DEFAULT SUBJECTS
   ========================================================= */

async function createDefaultSubjects() {

  if (!currentUser) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", currentUser.id)
      .limit(1);

    if (error) {

      console.error(error);

      return;

    }

    if (data && data.length > 0) {
      return;
    }

    const defaults = [

      {
        user_id: currentUser.id,
        name: "국어",
        color: "#ec4899"
      },

      {
        user_id: currentUser.id,
        name: "수학",
        color: "#6366f1"
      },

      {
        user_id: currentUser.id,
        name: "영어",
        color: "#22c55e"
      },

      {
        user_id: currentUser.id,
        name: "과학",
        color: "#06b6d4"
      }

    ];

    const {
      error: insertError
    } = await supabase
      .from("subjects")
      .insert(defaults);

    if (insertError) {

      console.error(
        "기본 과목 생성 오류:",
        insertError
      );

    }

  } catch (error) {

    console.error(error);

  }

}


/* =========================================================
   APP START
   ========================================================= */

async function startApp() {

  if (!currentUser) {
    return;
  }

  showApp();

  /*
   * 기존 DB에 프로필이 없는 경우 생성
   */

  await createProfileIfNeeded();

  await loadProfile();

  /*
   * 과목이 하나도 없는 신규 사용자라면
   * 기본 과목 생성
   */

  await createDefaultSubjects();

  await loadSubjects();

  await loadTodos();

  await restoreActiveSession();

  await refreshDashboard();

  showPage("home");

}


/* =========================================================
   SUBJECTS
   ========================================================= */

async function loadSubjects() {

  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "과목 조회 오류:",
      error
    );

    return;

  }

  subjects = data || [];

  /*
   * 선택했던 과목이 삭제된 경우
   */

  if (
    selectedSubjectId &&
    !subjects.some(
      s => s.id === selectedSubjectId
    )
  ) {

    selectedSubjectId = null;

  }

  renderSubjects();

}


function renderSubjects() {

  const studyList =
    $("#study-subject-list");

  const settingsList =
    $("#settings-subject-list");

  const todoSelect =
    $("#todo-subject-input");

  const modalList =
    $("#study-modal-subject-list");

  if (!studyList) return;

  studyList.innerHTML = "";

  if (settingsList) {
    settingsList.innerHTML = "";
  }

  if (modalList) {
    modalList.innerHTML = "";
  }

  if (todoSelect) {

    todoSelect.innerHTML =
      `<option value="">과목 없음</option>`;

  }

  if (subjects.length === 0) {

    studyList.innerHTML =
      `<div class="empty-state">
        과목을 추가해주세요.
      </div>`;

  }

  subjects.forEach(subject => {

    /*
     * 공부 화면
     */

    const studyCard =
      document.createElement("button");

    studyCard.type = "button";

    studyCard.className =
      "subject-card" +
      (
        selectedSubjectId === subject.id
          ? " selected"
          : ""
      );

    studyCard.innerHTML = `

      <span
        class="subject-dot"
        style="background:${escapeHtml(subject.color)}"
      ></span>

      <span class="subject-name">
        ${escapeHtml(subject.name)}
      </span>

    `;

    studyCard.addEventListener(
      "click",
      () => {

        selectedSubjectId =
          subject.id;

        renderSubjects();

        updateSelectedSubjectUI();

      }
    );

    studyList.appendChild(studyCard);


    /*
     * 설정 화면
     */

    if (settingsList) {

      const settingRow =
        document.createElement("div");

      settingRow.className =
        "settings-subject-row";

      settingRow.innerHTML = `

        <span
          class="subject-dot"
          style="background:${escapeHtml(subject.color)}"
        ></span>

        <span class="settings-subject-name">
          ${escapeHtml(subject.name)}
        </span>

        <button
          type="button"
          class="subject-action edit-subject-button"
          data-id="${subject.id}"
        >
          ✎
        </button>

        <button
          type="button"
          class="subject-action delete delete-subject-button"
          data-id="${subject.id}"
        >
          ×
        </button>

      `;

      settingRow
        .querySelector(".edit-subject-button")
        .addEventListener(
          "click",
          () => openEditSubject(subject.id)
        );

      settingRow
        .querySelector(".delete-subject-button")
        .addEventListener(
          "click",
          () => deleteSubject(subject.id)
        );

      settingsList.appendChild(settingRow);

    }


    /*
     * Todo 과목 선택
     */

    if (todoSelect) {

      const option =
        document.createElement("option");

      option.value =
        subject.id;

      option.textContent =
        subject.name;

      todoSelect.appendChild(option);

    }


    /*
     * 공부 시작 과목 선택 모달
     */

    if (modalList) {

      const modalButton =
        document.createElement("button");

      modalButton.type = "button";

      modalButton.className =
        "study-modal-subject";

      modalButton.innerHTML = `

        <span
          class="subject-dot"
          style="background:${escapeHtml(subject.color)}"
        ></span>

        ${escapeHtml(subject.name)}

      `;

      modalButton.addEventListener(
        "click",
        () => {

          selectedSubjectId =
            subject.id;

          closeModal(
            "study-subject-modal"
          );

          renderSubjects();

          updateSelectedSubjectUI();

        }
      );

      modalList.appendChild(modalButton);

    }

  });

  updateSelectedSubjectUI();

}


function updateSelectedSubjectUI() {

  const subject =
    subjects.find(
      s => s.id === selectedSubjectId
    );

  if ($("#study-selected-subject")) {

    $("#study-selected-subject").textContent =
      subject
        ? subject.name
        : "과목을 선택해주세요";

  }

  if ($("#home-current-subject")) {

    $("#home-current-subject").textContent =
      subject
        ? subject.name
        : "공부를 시작해보세요";

  }

}


/* =========================================================
   ADD SUBJECT
   ========================================================= */

function openAddSubject() {

  editingSubjectId = null;

  selectedColor = "#6366f1";

  $("#subject-modal-title").textContent =
    "과목 추가";

  $("#subject-name-input").value =
    "";

  $$(".color-option").forEach(button => {

    button.classList.toggle(
      "selected",
      button.dataset.color === selectedColor
    );

  });

  $("#subject-modal")
    .classList.remove("hidden");

}


/* =========================================================
   EDIT SUBJECT
   ========================================================= */

function openEditSubject(id) {

  const subject =
    subjects.find(
      s => s.id === id
    );

  if (!subject) return;

  editingSubjectId = id;

  selectedColor =
    subject.color || "#6366f1";

  $("#subject-modal-title").textContent =
    "과목 수정";

  $("#subject-name-input").value =
    subject.name;

  $$(".color-option").forEach(button => {

    button.classList.toggle(
      "selected",
      button.dataset.color === selectedColor
    );

  });

  $("#subject-modal")
    .classList.remove("hidden");

}


/* =========================================================
   SAVE SUBJECT
   ========================================================= */

async function saveSubject() {

  if (!currentUser) {
    return;
  }

  const name =
    $("#subject-name-input")
      .value
      .trim();

  if (!name) {

    toast("과목 이름을 입력해주세요.");

    return;

  }

  const button =
    $("#save-subject-btn");

  if (button) {

    button.disabled = true;
    button.textContent = "저장 중...";

  }

  try {

    if (editingSubjectId) {

      const {
        error
      } = await supabase
        .from("subjects")
        .update({

          name,
          color: selectedColor

        })
        .eq("id", editingSubjectId)
        .eq("user_id", currentUser.id);

      if (error) {

        console.error(error);

        toast(
          getSupabaseErrorMessage(error)
        );

        return;

      }

      toast("과목이 수정되었습니다.");

    } else {

      const {
        error
      } = await supabase
        .from("subjects")
        .insert({

          user_id: currentUser.id,

          name,

          color: selectedColor

        });

      if (error) {

        console.error(error);

        toast(
          getSupabaseErrorMessage(error)
        );

        return;

      }

      toast("과목이 추가되었습니다.");

    }

    closeModal("subject-modal");

    await loadSubjects();

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "저장";

    }

  }

}


/* =========================================================
   DELETE SUBJECT
   ========================================================= */

async function deleteSubject(id) {

  if (!currentUser) {
    return;
  }

  const subject =
    subjects.find(
      s => s.id === id
    );

  if (!subject) {
    return;
  }

  const confirmed =
    confirm(
      `"${subject.name}" 과목을 삭제할까요?\n\n기존 공부 기록은 유지됩니다.`
    );

  if (!confirmed) {
    return;
  }

  const {
    error
  } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {

    console.error(error);

    toast(
      getSupabaseErrorMessage(error)
    );

    return;

  }

  if (selectedSubjectId === id) {

    selectedSubjectId = null;

  }

  await loadSubjects();

  toast("과목이 삭제되었습니다.");

}


/* =========================================================
   STUDY SESSION
   ========================================================= */

async function restoreActiveSession() {

  if (!currentUser) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase
      .from("study_sessions")
      .select("*")
      .eq("user_id", currentUser.id)
      .is("ended_at", null)
      .order("started_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) {

      console.error(
        "진행 중 세션 조회 오류:",
        error
      );

      return;

    }

    if (!data) {

      currentSession = null;

      stopLocalTimer();

      updateStudyUI();

      return;

    }

    currentSession = data;

    selectedSubjectId =
      data.subject_id;

    startLocalTimer();

    updateStudyUI();

  } catch (error) {

    console.error(error);

  }

}


/* =========================================================
   START STUDY
   ========================================================= */

async function startStudy() {

  if (!currentUser) {
    return;
  }

  if (currentSession) {

    toast("이미 공부 중입니다.");

    return;

  }

  if (!selectedSubjectId) {

    openStudySubjectModal();

    toast("먼저 과목을 선택해주세요.");

    return;

  }

  const {
    data,
    error
  } = await supabase
    .from("study_sessions")
    .insert({

      user_id: currentUser.id,

      subject_id: selectedSubjectId,

      started_at:
        new Date().toISOString()

    })
    .select()
    .single();

  if (error) {

    console.error(error);

    toast(
      getSupabaseErrorMessage(error)
    );

    return;

  }

  currentSession = data;

  startLocalTimer();

  updateStudyUI();

  await loadTodayTime();

  toast("공부를 시작했습니다.");

}


/* =========================================================
   FINISH STUDY
   ========================================================= */

async function finishStudy() {

  if (!currentSession) {
    return;
  }

  const sessionId =
    currentSession.id;

  const {
    error
  } = await supabase
    .from("study_sessions")
    .update({

      ended_at:
        new Date().toISOString()

    })
    .eq("id", sessionId)
    .eq("user_id", currentUser.id);

  if (error) {

    console.error(error);

    toast(
      getSupabaseErrorMessage(error)
    );

    return;

  }

  stopLocalTimer();

  currentSession = null;

  updateStudyUI();

  await refreshDashboard();

  toast("공부 기록이 저장되었습니다.");

}


/* =========================================================
   TIMER
   ========================================================= */

function startLocalTimer() {

  stopLocalTimer();

  timerInterval =
    setInterval(
      updateStudyTimer,
      1000
    );

  updateStudyTimer();

}


function stopLocalTimer() {

  if (timerInterval) {

    clearInterval(timerInterval);

    timerInterval = null;

  }

}


function updateStudyTimer() {

  if (!currentSession) {

    if ($("#study-time")) {

      $("#study-time").textContent =
        "00:00:00";

    }

    return;

  }

  const seconds =
    sessionSeconds(
      currentSession
    );

  setTimerText(
    $("#study-time"),
    seconds
  );

  /*
   * 홈의 오늘 공부시간도
   * 실행 중에는 즉시 갱신
   */

  updateHomeRunningTime();

}


async function updateHomeRunningTime() {

  if (!currentUser || !currentSession) {
    return;
  }

  /*
   * 현재 세션의 시간을 포함한
   * 오늘 공부시간을 계산합니다.
   */

  const sessions =
    await getOwnSessions();

  const total =
    sessions
      .filter(
        s => isSameDayKST(
          s.started_at
        )
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );

  setTimerText(
    $("#home-today-time"),
    total
  );

}


function updateStudyUI() {

  const active =
    !!currentSession;

  if ($("#study-start-btn")) {

    $("#study-start-btn")
      .classList.toggle(
        "hidden",
        active
      );

  }

  if ($("#study-finish-btn")) {

    $("#study-finish-btn")
      .classList.toggle(
        "hidden",
        !active
      );

  }

  if ($("#study-pause-btn")) {

    $("#study-pause-btn")
      .classList.add("hidden");

  }

  if ($("#study-status")) {

    $("#study-status").textContent =
      active
        ? "공부 중"
        : "공부하지 않는 중";

  }

  if (!active) {

    if ($("#study-time")) {

      $("#study-time").textContent =
        "00:00:00";

    }

  }

  updateSelectedSubjectUI();

}


/* =========================================================
   SESSION HELPERS
   ========================================================= */

async function getOwnSessions() {

  if (!currentUser) {
    return [];
  }

  const {
    data,
    error
  } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("started_at", {
      ascending: true
    });

  if (error) {

    console.error(
      "공부 기록 조회 오류:",
      error
    );

    return [];

  }

  return data || [];

}


function sessionSeconds(session) {

  if (!session?.started_at) {
    return 0;
  }

  const start =
    new Date(
      session.started_at
    ).getTime();

  const end =
    session.ended_at
      ? new Date(
          session.ended_at
        ).getTime()
      : Date.now();

  return Math.max(
    0,
    Math.floor(
      (end - start) / 1000
    )
  );

}


/* =========================================================
   KOREA TIME
   ========================================================= */

function dateKST(date) {

  return new Date(date)
    .toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Seoul"
      }
    );

}


function isSameDayKST(
  date,
  target = new Date()
) {

  return (
    dateKST(date) ===
    dateKST(target)
  );

}


function getKSTDateParts(date = new Date()) {

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",

        year: "numeric",

        month: "2-digit",

        day: "2-digit"
      }
    ).formatToParts(date);

  const result = {};

  parts.forEach(
    part => {

      result[part.type] =
        part.value;

    }
  );

  return result;

}


function getWeekStartKST() {

  const parts =
    getKSTDateParts();

  const base =
    new Date(
      `${parts.year}-${parts.month}-${parts.day}T00:00:00+09:00`
    );

  const day =
    base.getDay();

  const diff =
    day === 0
      ? 6
      : day - 1;

  base.setDate(
    base.getDate() - diff
  );

  return base;

}


/* =========================================================
   DASHBOARD
   ========================================================= */

async function refreshDashboard() {

  await loadTodayTime();

  await loadTodos();

  await loadHomeRanking();

}


async function loadTodayTime() {

  if (!currentUser) {
    return 0;
  }

  const sessions =
    await getOwnSessions();

  const total =
    sessions
      .filter(
        s => isSameDayKST(
          s.started_at
        )
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );

  setTimerText(
    $("#home-today-time"),
    total
  );

  return total;

}


/* =========================================================
   TODO
   ========================================================= */

async function loadTodos() {

  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("completed", {
      ascending: true
    })
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(
      "Todo 조회 오류:",
      error
    );

    return;

  }

  todos = data || [];

  renderTodos();

  renderHomeTodos();

}


function renderHomeTodos() {

  const container =
    $("#home-todo-list");

  if (!container) {
    return;
  }

  const today =
    dateKST(
      new Date()
    );

  const list =
    todos
      .filter(todo => {

        return (
          !todo.due_date ||
          todo.due_date <= today
        );

      })
      .slice(0, 4);

  if (!list.length) {

    container.innerHTML =
      `<div class="empty-state">
        오늘의 할 일이 없습니다.
      </div>`;

    return;

  }

  container.innerHTML =
    list
      .map(todo => `

        <div
          class="home-todo-item ${
            todo.completed
              ? "completed"
              : ""
          }"
        >

          <button
            type="button"
            class="todo-check ${
              todo.completed
                ? "checked"
                : ""
            }"
            data-todo-toggle="${todo.id}"
          >
            ${
              todo.completed
                ? "✓"
                : ""
            }
          </button>

          <span>
            ${escapeHtml(todo.title)}
          </span>

        </div>

      `)
      .join("");

  container
    .querySelectorAll(
      "[data-todo-toggle]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const todo =
            todos.find(
              t =>
                t.id ===
                button.dataset.todoToggle
            );

          if (todo) {

            toggleTodo(
              todo.id,
              !todo.completed
            );

          }

        }
      );

    });

}


function renderTodos() {

  const container =
    $("#todo-list");

  if (!container) {
    return;
  }

  let filtered =
    [...todos];

  if (
    currentTodoFilter ===
    "active"
  ) {

    filtered =
      filtered.filter(
        todo => !todo.completed
      );

  }

  if (
    currentTodoFilter ===
    "completed"
  ) {

    filtered =
      filtered.filter(
        todo => todo.completed
      );

  }

  if (!filtered.length) {

    container.innerHTML =
      `<div class="empty-state">
        할 일이 없습니다.
      </div>`;

    return;

  }

  container.innerHTML =
    filtered
      .map(todo => {

        const subject =
          subjects.find(
            s =>
              s.id ===
              todo.subject_id
          );

        return `

          <div class="todo-item">

            <button
              type="button"
              class="todo-check ${
                todo.completed
                  ? "checked"
                  : ""
              }"
              data-toggle-id="${todo.id}"
            >
              ${
                todo.completed
                  ? "✓"
                  : ""
              }
            </button>

            <div
              class="todo-content ${
                todo.completed
                  ? "completed"
                  : ""
              }"
            >

              <strong>
                ${escapeHtml(todo.title)}
              </strong>

              <div class="todo-meta">

                ${
                  subject
                    ? escapeHtml(
                        subject.name
                      )
                    : "과목 없음"
                }

                ${
                  todo.due_date
                    ? ` · ${escapeHtml(
                        todo.due_date
                      )}`
                    : ""
                }

              </div>

            </div>

            <div class="todo-actions">

              <button
                type="button"
                class="todo-action edit-todo-button"
                data-id="${todo.id}"
              >
                ✎
              </button>

              <button
                type="button"
                class="todo-action delete-todo-button"
                data-id="${todo.id}"
              >
                ×
              </button>

            </div>

          </div>

        `;

      })
      .join("");

  container
    .querySelectorAll(
      ".edit-todo-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          openEditTodo(
            button.dataset.id
          )
      );

    });

  container
    .querySelectorAll(
      ".delete-todo-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () =>
          deleteTodo(
            button.dataset.id
          )
      );

    });

  container
    .querySelectorAll(
      "[data-toggle-id]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const todo =
            todos.find(
              t =>
                t.id ===
                button.dataset.toggleId
            );

          if (todo) {

            toggleTodo(
              todo.id,
              !todo.completed
            );

          }

        }
      );

    });

}


/* =========================================================
   ADD TODO
   ========================================================= */

function openAddTodo() {

  editingTodoId = null;

  $("#todo-modal-title").textContent =
    "할 일 추가";

  $("#todo-title-input").value =
    "";

  $("#todo-subject-input").value =
    "";

  $("#todo-date-input").value =
    dateKST(
      new Date()
    );

  $("#todo-modal")
    .classList.remove("hidden");

}


/* =========================================================
   EDIT TODO
   ========================================================= */

function openEditTodo(id) {

  const todo =
    todos.find(
      t => t.id === id
    );

  if (!todo) {
    return;
  }

  editingTodoId = id;

  $("#todo-modal-title").textContent =
    "할 일 수정";

  $("#todo-title-input").value =
    todo.title || "";

  $("#todo-subject-input").value =
    todo.subject_id || "";

  $("#todo-date-input").value =
    todo.due_date || "";

  $("#todo-modal")
    .classList.remove("hidden");

}


/* =========================================================
   SAVE TODO
   ========================================================= */

async function saveTodo() {

  if (!currentUser) {
    return;
  }

  const title =
    $("#todo-title-input")
      .value
      .trim();

  const subjectId =
    $("#todo-subject-input")
      .value || null;

  const dueDate =
    $("#todo-date-input")
      .value || null;

  if (!title) {

    toast("할 일을 입력해주세요.");

    return;

  }

  const button =
    $("#save-todo-btn");

  if (button) {

    button.disabled = true;
    button.textContent = "저장 중...";

  }

  try {

    if (editingTodoId) {

      const {
        error
      } = await supabase
        .from("todos")
        .update({

          title,

          subject_id:
            subjectId,

          due_date:
            dueDate

        })
        .eq("id", editingTodoId)
        .eq("user_id", currentUser.id);

      if (error) {

        console.error(error);

        toast(
          getSupabaseErrorMessage(error)
        );

        return;

      }

      toast("할 일이 수정되었습니다.");

    } else {

      const {
        error
      } = await supabase
        .from("todos")
        .insert({

          user_id:
            currentUser.id,

          title,

          subject_id:
            subjectId,

          due_date:
            dueDate

        });

      if (error) {

        console.error(error);

        toast(
          getSupabaseErrorMessage(error)
        );

        return;

      }

      toast("할 일이 추가되었습니다.");

    }

    closeModal("todo-modal");

    await loadTodos();

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent = "저장";

    }

  }

}


/* =========================================================
   TOGGLE TODO
   ========================================================= */

async function toggleTodo(
  id,
  completed
) {

  if (!currentUser) {
    return;
  }

  const {
    error
  } = await supabase
    .from("todos")
    .update({
      completed
    })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {

    console.error(error);

    toast(
      getSupabaseErrorMessage(error)
    );

    return;

  }

  await loadTodos();

}


/* =========================================================
   DELETE TODO
   ========================================================= */

async function deleteTodo(id) {

  if (!currentUser) {
    return;
  }

  if (
    !confirm(
      "이 할 일을 삭제할까요?"
    )
  ) {

    return;

  }

  const {
    error
  } = await supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {

    console.error(error);

    toast(
      getSupabaseErrorMessage(error)
    );

    return;

  }

  await loadTodos();

  toast("삭제되었습니다.");

}


/* =========================================================
   RANKING
   ========================================================= */

async function loadHomeRanking() {

  const container =
    $("#home-ranking");

  if (!container) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase.rpc(
      "get_class_ranking",
      {
        target_period: "today"
      }
    );

    if (error) {

      console.error(
        "홈 랭킹 오류:",
        error
      );

      container.innerHTML =
        `<div class="empty-state">
          랭킹을 불러오지 못했습니다.
        </div>`;

      return;

    }

    const list =
      (data || []).slice(0, 5);

    if (!list.length) {

      container.innerHTML =
        `<div class="empty-state">
          같은 반 친구가 아직 없습니다.
        </div>`;

      return;

    }

    container.innerHTML =
      list
        .map(
          (item, index) =>
            rankingRow(
              item,
              index
            )
        )
        .join("");

  } catch (error) {

    console.error(error);

    container.innerHTML =
      `<div class="empty-state">
        랭킹을 불러오지 못했습니다.
      </div>`;

  }

}


async function loadRanking() {

  const container =
    $("#ranking-list");

  if (!container) {
    return;
  }

  try {

    const {
      data,
      error
    } = await supabase.rpc(
      "get_class_ranking",
      {
        target_period:
          currentRankingPeriod
      }
    );

    if (error) {

      console.error(
        "랭킹 오류:",
        error
      );

      container.innerHTML =
        `<div class="empty-state">
          랭킹을 불러오지 못했습니다.
        </div>`;

      return;

    }

    const list =
      data || [];

    if (!list.length) {

      container.innerHTML =
        `<div class="empty-state">
          같은 반 친구가 없습니다.
        </div>`;

      return;

    }

    container.innerHTML =
      list
        .map(
          (item, index) =>
            rankingRow(
              item,
              index
            )
        )
        .join("");

  } catch (error) {

    console.error(error);

    container.innerHTML =
      `<div class="empty-state">
        랭킹을 불러오지 못했습니다.
      </div>`;

  }

}


function rankingRow(
  item,
  index
) {

  const medal =
    index === 0
      ? "🥇"
      : index === 1
        ? "🥈"
        : index === 2
          ? "🥉"
          : String(index + 1);

  const isMe =
    currentUser &&
    item.user_id ===
      currentUser.id;

  return `

    <div
      class="rank-row ${
        isMe
          ? "me-row"
          : ""
      }"
    >

      <div class="rank-number">
        ${medal}
      </div>

      <div class="rank-name">

        ${escapeHtml(
          item.name || "사용자"
        )}

        ${
          isMe
            ? " (나)"
            : ""
        }

      </div>

      <div class="rank-time">

        ${formatSeconds(
          Number(
            item.total_seconds || 0
          )
        )}

      </div>

    </div>

  `;

}


/* =========================================================
   STATISTICS
   ========================================================= */

async function loadStatistics() {

  if (!currentUser) {
    return;
  }

  const sessions =
    await getOwnSessions();

  const todaySeconds =
    sessions
      .filter(
        s =>
          isSameDayKST(
            s.started_at
          )
      )
      .reduce(
        (sum, s) =>
          sum +
          sessionSeconds(s),
        0
      );

  const weekStart =
    getWeekStartKST();

  const weekSeconds =
    sessions
      .filter(
        s =>
          new Date(
            s.started_at
          ) >= weekStart
      )
      .reduce(
        (sum, s) =>
          sum +
          sessionSeconds(s),
        0
      );

  const now =
    new Date();

  const kstParts =
    getKSTDateParts(now);

  const monthStart =
    new Date(
      `${kstParts.year}-${kstParts.month}-01T00:00:00+09:00`
    );

  const monthSeconds =
    sessions
      .filter(
        s =>
          new Date(
            s.started_at
          ) >= monthStart
      )
      .reduce(
        (sum, s) =>
          sum +
          sessionSeconds(s),
        0
      );

  const totalSeconds =
    sessions.reduce(
      (sum, s) =>
        sum +
        sessionSeconds(s),
      0
    );

  if ($("#stat-today")) {

    $("#stat-today").textContent =
      formatShortDuration(
        todaySeconds
      );

  }

  if ($("#stat-week")) {

    $("#stat-week").textContent =
      formatShortDuration(
        weekSeconds
      );

  }

  if ($("#stat-month")) {

    $("#stat-month").textContent =
      formatShortDuration(
        monthSeconds
      );

  }

  if ($("#stat-total")) {

    $("#stat-total").textContent =
      formatShortDuration(
        totalSeconds
      );

  }

  renderWeeklyChart(
    sessions
  );

  renderSubjectStats(
    sessions
  );

}


/* =========================================================
   WEEKLY CHART
   ========================================================= */

function renderWeeklyChart(
  sessions
) {

  const container =
    $("#weekly-chart");

  if (!container) {
    return;
  }

  const start =
    getWeekStartKST();

  const days = [];

  for (
    let i = 0;
    i < 7;
    i++
  ) {

    const date =
      new Date(start);

    date.setDate(
      start.getDate() + i
    );

    days.push(date);

  }

  const values =
    days.map(day => {

      const key =
        dateKST(day);

      return sessions
        .filter(
          s =>
            dateKST(
              s.started_at
            ) === key
        )
        .reduce(
          (sum, s) =>
            sum +
            sessionSeconds(s),
          0
        );

    });

  const max =
    Math.max(
      ...values,
      1
    );

  const labels =
    [
      "월",
      "화",
      "수",
      "목",
      "금",
      "토",
      "일"
    ];

  container.innerHTML =
    values
      .map(
        (value, index) => {

          const height =
            Math.max(
              3,
              (
                value / max
              ) * 160
            );

          return `

            <div class="bar-column">

              <span class="bar-value">
                ${formatShortDuration(
                  value
                )}
              </span>

              <div
                class="bar"
                style="
                  height:${height}px
                "
              ></div>

              <span class="bar-day">
                ${labels[index]}
              </span>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   SUBJECT STATISTICS
   ========================================================= */

function renderSubjectStats(
  sessions
) {

  const container =
    $("#subject-stats");

  if (!container) {
    return;
  }

  const totals = {};

  sessions.forEach(
    session => {

      const id =
        session.subject_id ||
        "none";

      totals[id] =
        (
          totals[id] || 0
        ) +
        sessionSeconds(
          session
        );

    }
  );

  const entries =
    Object.entries(
      totals
    )
    .sort(
      (a, b) =>
        b[1] - a[1]
    );

  if (!entries.length) {

    container.innerHTML =
      `<div class="empty-state">
        아직 공부 기록이 없습니다.
      </div>`;

    return;

  }

  const max =
    entries[0][1];

  container.innerHTML =
    entries
      .map(
        ([id, seconds]) => {

          const subject =
            subjects.find(
              s => s.id === id
            );

          const name =
            subject
              ? subject.name
              : "과목 없음";

          const color =
            subject
              ? subject.color
              : "#94a3b8";

          const percent =
            max > 0
              ? (
                  seconds /
                  max
                ) * 100
              : 0;

          return `

            <div
              class="subject-stat-row"
            >

              <div
                class="subject-stat-top"
              >

                <span>
                  ${escapeHtml(
                    name
                  )}
                </span>

                <strong>
                  ${formatShortDuration(
                    seconds
                  )}
                </strong>

              </div>

              <div class="progress">

                <div
                  class="progress-fill"
                  style="
                    width:${percent}%;
                    background:${escapeHtml(
                      color
                    )};
                  "
                ></div>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(
  pageName
) {

  $$(".page").forEach(
    page => {

      page.classList.remove(
        "active"
      );

    }
  );

  const page =
    $(`#page-${pageName}`);

  if (page) {

    page.classList.add(
      "active"
    );

  }

  $$(".nav-btn").forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
          pageName
      );

    }
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (
    pageName ===
    "ranking"
  ) {

    loadRanking();

  }

  if (
    pageName ===
    "statistics"
  ) {

    loadStatistics();

  }

  if (
    pageName ===
    "todos"
  ) {

    loadTodos();

  }

  if (
    pageName ===
    "settings"
  ) {

    loadProfile();
    loadSubjects();

  }

  if (
    pageName ===
    "study"
  ) {

    loadSubjects();

  }

  if (
    pageName ===
    "home"
  ) {

    refreshDashboard();

  }

}


/* =========================================================
   MODALS
   ========================================================= */

function openStudySubjectModal() {

  renderSubjects();

  $("#study-subject-modal")
    .classList.remove(
      "hidden"
    );

}


function closeModal(id) {

  const modal =
    $(`#${id}`);

  if (modal) {

    modal.classList.add(
      "hidden"
    );

  }

}


/* =========================================================
   EVENT BINDINGS
   ========================================================= */

function bindEvents() {

  /*
   * LOGIN
   */

  $("#login-btn")
    ?.addEventListener(
      "click",
      login
    );


  /*
   * SIGNUP
   */

  $("#signup-btn")
    ?.addEventListener(
      "click",
      signup
    );


  /*
   * LOGOUT
   */

  $("#logout-btn")
    ?.addEventListener(
      "click",
      logout
    );


  /*
   * AUTH FORM SWITCH
   */

  $("#show-signup-btn")
    ?.addEventListener(
      "click",
      showSignupForm
    );

  $("#show-login-btn")
    ?.addEventListener(
      "click",
      showLoginForm
    );


  /*
   * ENTER KEY LOGIN
   */

  $("#login-password")
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          login();

        }

      }
    );


  /*
   * ENTER KEY SIGNUP
   */

  $("#signup-password")
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          signup();

        }

      }
    );


  /*
   * HOME START
   */

  $("#home-start-btn")
    ?.addEventListener(
      "click",
      () => {

        if (
          !selectedSubjectId
        ) {

          openStudySubjectModal();

          return;

        }

        startStudy();

      }
    );


  /*
   * STUDY START
   */

  $("#study-start-btn")
    ?.addEventListener(
      "click",
      () => {

        if (
          !selectedSubjectId
        ) {

          openStudySubjectModal();

          return;

        }

        startStudy();

      }
    );


  /*
   * STUDY FINISH
   */

  $("#study-finish-btn")
    ?.addEventListener(
      "click",
      finishStudy
    );


  /*
   * ADD SUBJECT
   */

  $("#add-subject-btn")
    ?.addEventListener(
      "click",
      openAddSubject
    );

  $("#add-subject-from-study")
    ?.addEventListener(
      "click",
      openAddSubject
    );


  /*
   * SAVE SUBJECT
   */

  $("#save-subject-btn")
    ?.addEventListener(
      "click",
      saveSubject
    );


  /*
   * ADD TODO
   */

  $("#add-todo-btn")
    ?.addEventListener(
      "click",
      openAddTodo
    );


  /*
   * SAVE TODO
   */

  $("#save-todo-btn")
    ?.addEventListener(
      "click",
      saveTodo
    );


  /*
   * SAVE PROFILE
   */

  $("#save-profile-btn")
    ?.addEventListener(
      "click",
      saveProfile
    );


  /*
   * BOTTOM NAV
   */

  $$(".nav-btn")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    });


  /*
   * HOME OTHER PAGE BUTTONS
   */

  $$("[data-page]")
    .forEach(button => {

      if (
        button.classList.contains(
          "nav-btn"
        )
      ) {

        return;

      }

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    });


  /*
   * RANKING PERIOD
   */

  $$(".ranking-period")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          $$(".ranking-period")
            .forEach(
              b =>
                b.classList.remove(
                  "active"
                )
            );

          button.classList.add(
            "active"
          );

          currentRankingPeriod =
            button.dataset.period;

          loadRanking();

        }
      );

    });


  /*
   * TODO FILTER
   */

  $$(".todo-filter-btn")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          $$(".todo-filter-btn")
            .forEach(
              b =>
                b.classList.remove(
                  "active"
                )
            );

          button.classList.add(
            "active"
          );

          currentTodoFilter =
            button.dataset.filter;

          renderTodos();

        }
      );

    });


  /*
   * MODAL CLOSE
   */

  $$(".modal-close")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          closeModal(
            button.dataset.close
          );

        }
      );

    });


  /*
   * COLOR PICKER
   */

  $$(".color-option")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedColor =
            button.dataset.color;

          $$(".color-option")
            .forEach(
              b =>
                b.classList.remove(
                  "selected"
                )
            );

          button.classList.add(
            "selected"
          );

        }
      );

    });


  /*
   * ESC KEY
   */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        $$(".modal")
          .forEach(
            modal =>
              modal.classList.add(
                "hidden"
              )
          );

      }

    }
  );


  /*
   * SUPABASE AUTH STATE
   */

  supabase.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      console.log(
        "Auth event:",
        event
      );

      if (
        (
          event ===
          "SIGNED_IN"
        ) &&
        session?.user
      ) {

        /*
         * 현재 로그인된 사용자가 이미 앱을
         * 초기화했다면 중복 실행을 피합니다.
         */

        if (
          !currentUser ||
          currentUser.id !==
            session.user.id
        ) {

          currentUser =
            session.user;

          await startApp();

        }

      }

      if (
        event ===
        "SIGNED_OUT"
      ) {

        currentUser =
          null;

        currentProfile =
          null;

        currentSession =
          null;

        subjects = [];

        todos = [];

        stopLocalTimer();

        showAuth();

      }

    }
  );

}


/* =========================================================
   AUTH FORM SWITCH
   ========================================================= */

function showSignupForm() {

  $("#login-form")
    .classList.add(
      "hidden"
    );

  $("#signup-form")
    .classList.remove(
      "hidden"
    );

}


function showLoginForm() {

  $("#signup-form")
    .classList.add(
      "hidden"
    );

  $("#login-form")
    .classList.remove(
      "hidden"
    );

}


/* =========================================================
   TIMER FORMAT
   ========================================================= */

function setTimerText(
  element,
  seconds
) {

  if (!element) {
    return;
  }

  element.textContent =
    formatSeconds(
      seconds
    );

}


function formatSeconds(
  seconds
) {

  seconds =
    Math.max(
      0,
      Math.floor(
        Number(seconds) ||
        0
      )
    );

  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  const secs =
    seconds % 60;

  return [

    hours,

    minutes,

    secs

  ]
    .map(
      value =>
        String(value)
          .padStart(
            2,
            "0"
          )
    )
    .join(":");

}


function formatShortDuration(
  seconds
) {

  seconds =
    Math.max(
      0,
      Math.floor(
        Number(seconds) ||
        0
      )
    );

  const hours =
    Math.floor(
      seconds / 3600
    );

  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  if (hours > 0) {

    return `${hours}시간 ${minutes}분`;

  }

  return `${minutes}분`;

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================================
   TOAST
   ========================================================= */

function toast(
  message
) {

  const element =
    $("#toast");

  const messageElement =
    $("#toast-message");

  if (
    !element ||
    !messageElement
  ) {

    alert(message);

    return;

  }

  messageElement.textContent =
    message;

  element.classList.add(
    "show"
  );

  clearTimeout(
    toastTimeout
  );

  toastTimeout =
    setTimeout(
      () => {

        element.classList.remove(
          "show"
        );

      },
      3000
    );

}


/* =========================================================
   SUPABASE ERROR MESSAGE
   ========================================================= */

function getSupabaseErrorMessage(
  error
) {

  if (!error) {
    return "알 수 없는 오류가 발생했습니다.";
  }

  console.error(
    "Supabase error:",
    error
  );

  const message =
    error.message || "";

  /*
   * 자주 발생하는 오류를
   * 사용자가 이해하기 쉽게 표시
   */

  if (
    message.includes(
      "Invalid login credentials"
    )
  ) {

    return "이메일 또는 비밀번호가 올바르지 않습니다.";

  }

  if (
    message.includes(
      "Email not confirmed"
    )
  ) {

    return "이메일 인증이 필요합니다. 가입한 이메일을 확인해주세요.";

  }

  if (
    message.includes(
      "User already registered"
    )
  ) {

    return "이미 가입된 이메일입니다.";

  }

  if (
    message.includes(
      "duplicate key"
    )
  ) {

    return "이미 존재하는 데이터입니다.";

  }

  if (
    message.includes(
      "violates row-level security"
    ) ||
    message.includes(
      "row-level security policy"
    )
  ) {

    return "Supabase 보안 정책(RLS) 때문에 요청이 차단되었습니다.";

  }

  if (
    message.includes(
      "violates check constraint"
    )
  ) {

    return "입력한 값이 데이터베이스의 허용 범위를 벗어났습니다.";

  }

  if (
    message.includes(
      "relation"
    ) &&
    message.includes(
      "does not exist"
    )
  ) {

    return "Supabase에 필요한 테이블이 없습니다.";

  }

  return message ||
    "오류가 발생했습니다.";

}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      !document.hidden &&
      currentUser
    ) {

      await restoreActiveSession();

      await loadTodayTime();

    }

  }
);


/* =========================================================
   EXPOSE
   ========================================================= */

window.toggleTodo =
  toggleTodo;

window.openEditTodo =
  openEditTodo;

window.deleteTodo =
  deleteTodo;

window.openEditSubject =
  openEditSubject;

window.deleteSubject =
  deleteSubject;
