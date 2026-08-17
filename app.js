/* =========================================================
   StudyRank
   GitHub Pages + Supabase
========================================================= */

/* =========================================================
   SUPABASE 설정
========================================================= */

const SUPABASE_URL = "https://yzlmzgkbrpugukzqbbie.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_pYwcnBryBcOtCiK5RERs_g_mf_HHRU_";

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
let timerStartedAt = null;
let pausedSeconds = 0;

let currentTodoFilter = "all";
let currentRankingPeriod = "today";


/* =========================================================
   DOM
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  bindEvents();

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

});


/* =========================================================
   AUTH
========================================================= */

function showAuth() {

  $("#auth-screen").classList.remove("hidden");
  $("#app-screen").classList.add("hidden");

}

function showApp() {

  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");

}


async function login() {

  const email =
    $("#login-email").value.trim();

  const password =
    $("#login-password").value;

  if (!email || !password) {

    toast("이메일과 비밀번호를 입력해주세요.");

    return;

  }

  const button = $("#login-btn");

  button.disabled = true;
  button.textContent = "로그인 중...";

  const {
    data,
    error
  } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  button.disabled = false;
  button.textContent = "로그인";

  if (error) {

    toast(error.message);

    return;

  }

  currentUser = data.user;

  await startApp();

}


async function signup() {

  const name =
    $("#signup-name").value.trim();

  const email =
    $("#signup-email").value.trim();

  const password =
    $("#signup-password").value;

  const school =
    $("#signup-school").value.trim();

  const grade =
    Number($("#signup-grade").value);

  const classNumber =
    Number($("#signup-class").value);

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

  const button = $("#signup-btn");

  button.disabled = true;
  button.textContent = "가입 중...";


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


  button.disabled = false;
  button.textContent = "회원가입";


  if (error) {

    toast(error.message);

    return;

  }


  if (!data.user) {

    toast("회원가입에 실패했습니다.");

    return;

  }


  /*
   * 이메일 확인이 켜져 있으면
   * session이 바로 생기지 않을 수 있습니다.
   */

  if (!data.session) {

    toast("가입 완료! 이메일을 확인한 뒤 로그인해주세요.");

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

}


async function logout() {

  await supabase.auth.signOut();

  currentUser = null;
  currentProfile = null;
  subjects = [];
  todos = [];

  stopLocalTimer();

  showAuth();

}


/* =========================================================
   PROFILE
========================================================= */

async function createProfileIfNeeded(profileData = null) {

  if (!currentUser && !profileData) return;

  const userId =
    profileData?.id || currentUser.id;


  const {
    data: existing,
    error: existingError
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();


  if (existingError) {

    console.error(existingError);

    return;

  }


  if (existing) {

    currentProfile = existing;

    return;

  }


  if (!profileData) {

    const metadata =
      currentUser.user_metadata || {};

    profileData = {

      id: userId,

      name:
        metadata.name ||
        currentUser.email?.split("@")[0] ||
        "사용자",

      school:
        metadata.school || "",

      grade:
        Number(metadata.grade) || 1,

      class_number:
        Number(metadata.class_number) || 1

    };

  }


  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .insert(profileData)
    .select()
    .single();


  if (error) {

    console.error(error);
    toast("프로필 생성 중 오류가 발생했습니다.");

    return;

  }


  currentProfile = data;

}


async function loadProfile() {

  if (!currentUser) return;

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


  if (data) {

    $("#top-user-name").textContent =
      data.name;

    $("#home-greeting").textContent =
      `${data.name}님, 안녕하세요 👋`;

    $("#profile-name").value =
      data.name;

    $("#profile-school").value =
      data.school;

    $("#profile-grade").value =
      data.grade;

    $("#profile-class").value =
      data.class_number;

    $("#ranking-class-info").textContent =
      `${data.school} ${data.grade}학년 ${data.class_number}반`;

  }

}


async function saveProfile() {

  if (!currentUser) return;

  const name =
    $("#profile-name").value.trim();

  const school =
    $("#profile-school").value.trim();

  const grade =
    Number($("#profile-grade").value);

  const classNumber =
    Number($("#profile-class").value);


  if (!name || !school || !grade || !classNumber) {

    toast("모든 정보를 입력해주세요.");

    return;

  }


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

    toast(error.message);

    return;

  }


  currentProfile = data;

  await loadProfile();

  toast("정보가 저장되었습니다.");

  await loadRanking();

}


/* =========================================================
   DEFAULT SUBJECTS
========================================================= */

async function createDefaultSubjects() {

  const {
    count,
    error
  } = await supabase
    .from("subjects")
    .select("*", {
      count: "exact",
      head: true
    })
    .eq("user_id", currentUser.id);


  if (error) {

    console.error(error);

    return;

  }


  if (count > 0) return;


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


  await supabase
    .from("subjects")
    .insert(defaults);

}


/* =========================================================
   LOAD APP
========================================================= */

async function startApp() {

  showApp();

  await createProfileIfNeeded();

  await loadProfile();

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

    console.error(error);

    return;

  }


  subjects = data || [];

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


  studyList.innerHTML = "";
  settingsList.innerHTML = "";
  modalList.innerHTML = "";


  todoSelect.innerHTML =
    `<option value="">과목 없음</option>`;


  if (subjects.length === 0) {

    studyList.innerHTML =
      `<div class="empty-state">
        과목을 추가해주세요.
      </div>`;

  }


  subjects.forEach(subject => {

    const studyCard =
      document.createElement("button");

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
        style="background:${subject.color}"
      ></span>
      <span class="subject-name">
        ${escapeHtml(subject.name)}
      </span>
    `;

    studyCard.onclick = () => {

      selectedSubjectId =
        subject.id;

      renderSubjects();

      updateSelectedSubjectUI();

    };

    studyList.appendChild(studyCard);


    const settingRow =
      document.createElement("div");

    settingRow.className =
      "settings-subject-row";

    settingRow.innerHTML = `

      <span
        class="subject-dot"
        style="background:${subject.color}"
      ></span>

      <span class="settings-subject-name">
        ${escapeHtml(subject.name)}
      </span>

      <button
        class="subject-action"
        onclick="openEditSubject('${subject.id}')"
      >
        ✎
      </button>

      <button
        class="subject-action delete"
        onclick="deleteSubject('${subject.id}')"
      >
        ×
      </button>

    `;

    settingsList.appendChild(settingRow);


    const option =
      document.createElement("option");

    option.value =
      subject.id;

    option.textContent =
      subject.name;

    todoSelect.appendChild(option);


    const modalButton =
      document.createElement("button");

    modalButton.className =
      "study-modal-subject";

    modalButton.innerHTML = `

      <span
        class="subject-dot"
        style="background:${subject.color}"
      ></span>

      ${escapeHtml(subject.name)}

    `;

    modalButton.onclick = () => {

      selectedSubjectId =
        subject.id;

      $("#study-subject-modal")
        .classList.add("hidden");

      updateSelectedSubjectUI();

      renderSubjects();

    };

    modalList.appendChild(modalButton);

  });


  updateSelectedSubjectUI();

}


function updateSelectedSubjectUI() {

  const subject =
    subjects.find(
      s => s.id === selectedSubjectId
    );


  if (subject) {

    $("#study-selected-subject").textContent =
      subject.name;

    $("#home-current-subject").textContent =
      subject.name;

  } else {

    $("#study-selected-subject").textContent =
      "과목을 선택해주세요";

    $("#home-current-subject").textContent =
      "공부를 시작해보세요";

  }

}


function openAddSubject() {

  editingSubjectId = null;

  selectedColor = "#6366f1";

  $("#subject-modal-title").textContent =
    "과목 추가";

  $("#subject-name-input").value = "";

  $$(".color-option").forEach(button => {

    button.classList.remove("selected");

    if (
      button.dataset.color === selectedColor
    ) {

      button.classList.add("selected");

    }

  });


  $("#subject-modal").classList.remove("hidden");

}


function openEditSubject(id) {

  const subject =
    subjects.find(
      s => s.id === id
    );

  if (!subject) return;

  editingSubjectId = id;

  selectedColor = subject.color;

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


  $("#subject-modal").classList.remove("hidden");

}


async function saveSubject() {

  const name =
    $("#subject-name-input").value.trim();


  if (!name) {

    toast("과목 이름을 입력해주세요.");

    return;

  }


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

      toast(error.message);

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

      toast(error.message);

      return;

    }

    toast("과목이 추가되었습니다.");

  }


  $("#subject-modal").classList.add("hidden");

  await loadSubjects();

}


async function deleteSubject(id) {

  const subject =
    subjects.find(
      s => s.id === id
    );

  if (!subject) return;


  if (
    !confirm(
      `"${subject.name}" 과목을 삭제할까요?\n기존 공부 기록은 유지됩니다.`
    )
  ) {

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

    toast(error.message);

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

  const {
    data,
    error
  } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", currentUser.id)
    .is("ended_at", null)
    .maybeSingle();


  if (error) {

    console.error(error);

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

  timerStartedAt =
    new Date(data.started_at).getTime();

  pausedSeconds = 0;

  startLocalTimer();

  updateStudyUI();

}


async function startStudy() {

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
      started_at: new Date().toISOString()

    })
    .select()
    .single();


  if (error) {

    console.error(error);

    toast(error.message);

    return;

  }


  currentSession = data;

  timerStartedAt =
    new Date(data.started_at).getTime();

  pausedSeconds = 0;

  startLocalTimer();

  updateStudyUI();

  toast("공부를 시작했습니다.");

}


async function finishStudy() {

  if (!currentSession) return;


  const {
    error
  } = await supabase
    .from("study_sessions")
    .update({

      ended_at: new Date().toISOString()

    })
    .eq("id", currentSession.id)
    .eq("user_id", currentUser.id);


  if (error) {

    toast(error.message);

    return;

  }


  stopLocalTimer();

  currentSession = null;

  timerStartedAt = null;

  pausedSeconds = 0;

  updateStudyUI();

  await refreshDashboard();

  toast("공부 기록이 저장되었습니다.");

}


function startLocalTimer() {

  stopLocalTimer();

  timerInterval =
    setInterval(() => {

      updateStudyTimer();

    }, 1000);

  updateStudyTimer();

}


function stopLocalTimer() {

  if (timerInterval) {

    clearInterval(timerInterval);

    timerInterval = null;

  }

}


function updateStudyTimer() {

  if (!timerStartedAt) {

    setTimerText(
      $("#study-time"),
      0
    );

    return;

  }


  const elapsed =
    Math.floor(
      (Date.now() - timerStartedAt) / 1000
    ) - pausedSeconds;


  setTimerText(
    $("#study-time"),
    Math.max(0, elapsed)
  );


  updateStudyUI();

}


function updateStudyUI() {

  const active =
    !!currentSession;


  $("#study-start-btn")
    .classList.toggle(
      "hidden",
      active
    );


  $("#study-finish-btn")
    .classList.toggle(
      "hidden",
      !active
    );


  $("#study-pause-btn")
    .classList.add("hidden");


  $("#study-status").textContent =
    active
      ? "공부 중"
      : "공부하지 않는 중";


  if (!active) {

    $("#study-time").textContent =
      "00:00:00";

  }


  updateSelectedSubjectUI();

}


/* =========================================================
   DAILY TIME
========================================================= */

async function getOwnSessions() {

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

    console.error(error);

    return [];

  }


  return data || [];

}


function sessionSeconds(session) {

  const start =
    new Date(session.started_at)
      .getTime();

  const end =
    session.ended_at
      ? new Date(session.ended_at).getTime()
      : Date.now();


  return Math.max(
    0,
    Math.floor((end - start) / 1000)
  );

}


function isSameDayKST(date, target = new Date()) {

  const a =
    new Date(
      date
    ).toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Seoul"
      }
    );

  const b =
    new Date(
      target
    ).toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Seoul"
      }
    );


  return a === b;

}


function dateKST(date) {

  return new Date(date)
    .toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Seoul"
      }
    );

}


function getWeekStartKST() {

  const now =
    new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(now);

  const map = {};

  parts.forEach(p => {
    map[p.type] = p.value;
  });

  const base =
    new Date(
      `${map.year}-${map.month}-${map.day}T00:00:00+09:00`
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

  const sessions =
    await getOwnSessions();


  const total =
    sessions
      .filter(
        s => isSameDayKST(s.started_at)
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );


  let runningSeconds = 0;


  if (currentSession) {

    runningSeconds =
      sessionSeconds(
        currentSession
      );

  }


  /*
   * currentSession이 포함된 경우
   * 위 total에도 들어가 있으므로
   * 별도로 더하지 않습니다.
   */

  setTimerText(
    $("#home-today-time"),
    total
  );


  return total;

}


/* =========================================================
   TODOS
========================================================= */

async function loadTodos() {

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

    console.error(error);

    return;

  }


  todos = data || [];

  renderTodos();

  renderHomeTodos();

}


function renderHomeTodos() {

  const container =
    $("#home-todo-list");

  const today =
    new Date()
      .toLocaleDateString(
        "en-CA",
        {
          timeZone: "Asia/Seoul"
        }
      );


  const list =
    todos
      .filter(todo =>
        !todo.due_date ||
        todo.due_date <= today
      )
      .slice(0, 4);


  if (!list.length) {

    container.innerHTML =
      `<div class="empty-state">
        오늘의 할 일이 없습니다.
      </div>`;

    return;

  }


  container.innerHTML =
    list.map(todo => `

      <div
        class="home-todo-item ${
          todo.completed ? "completed" : ""
        }"
      >

        <button
          class="todo-check ${
            todo.completed ? "checked" : ""
          }"
          onclick="toggleTodo('${todo.id}', ${!todo.completed})"
        >
          ${todo.completed ? "✓" : ""}
        </button>

        <span>
          ${escapeHtml(todo.title)}
        </span>

      </div>

    `).join("");

}


function renderTodos() {

  const container =
    $("#todo-list");


  let filtered =
    todos;


  if (currentTodoFilter === "active") {

    filtered =
      todos.filter(
        todo => !todo.completed
      );

  }


  if (currentTodoFilter === "completed") {

    filtered =
      todos.filter(
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
    filtered.map(todo => {

      const subject =
        subjects.find(
          s => s.id === todo.subject_id
        );


      return `

        <div class="todo-item">

          <button
            class="todo-check ${
              todo.completed ? "checked" : ""
            }"
            onclick="toggleTodo('${todo.id}', ${!todo.completed})"
          >
            ${todo.completed ? "✓" : ""}
          </button>

          <div
            class="todo-content ${
              todo.completed ? "completed" : ""
            }"
          >

            <strong>
              ${escapeHtml(todo.title)}
            </strong>

            <div class="todo-meta">

              ${
                subject
                  ? escapeHtml(subject.name)
                  : "과목 없음"
              }

              ${
                todo.due_date
                  ? ` · ${todo.due_date}`
                  : ""
              }

            </div>

          </div>

          <div class="todo-actions">

            <button
              class="todo-action"
              onclick="openEditTodo('${todo.id}')"
            >
              ✎
            </button>

            <button
              class="todo-action"
              onclick="deleteTodo('${todo.id}')"
            >
              ×
            </button>

          </div>

        </div>

      `;

    }).join("");

}


function openAddTodo() {

  editingTodoId = null;

  $("#todo-modal-title").textContent =
    "할 일 추가";

  $("#todo-title-input").value = "";

  $("#todo-subject-input").value = "";

  $("#todo-date-input").value =
    new Date()
      .toLocaleDateString(
        "en-CA",
        {
          timeZone: "Asia/Seoul"
        }
      );

  $("#todo-modal").classList.remove("hidden");

}


function openEditTodo(id) {

  const todo =
    todos.find(
      t => t.id === id
    );

  if (!todo) return;

  editingTodoId = id;

  $("#todo-modal-title").textContent =
    "할 일 수정";

  $("#todo-title-input").value =
    todo.title;

  $("#todo-subject-input").value =
    todo.subject_id || "";

  $("#todo-date-input").value =
    todo.due_date || "";

  $("#todo-modal").classList.remove("hidden");

}


async function saveTodo() {

  const title =
    $("#todo-title-input").value.trim();

  const subjectId =
    $("#todo-subject-input").value || null;

  const dueDate =
    $("#todo-date-input").value || null;


  if (!title) {

    toast("할 일을 입력해주세요.");

    return;

  }


  if (editingTodoId) {

    const {
      error
    } = await supabase
      .from("todos")
      .update({

        title,
        subject_id: subjectId,
        due_date: dueDate

      })
      .eq("id", editingTodoId)
      .eq("user_id", currentUser.id);


    if (error) {

      toast(error.message);

      return;

    }


    toast("할 일이 수정되었습니다.");

  } else {

    const {
      error
    } = await supabase
      .from("todos")
      .insert({

        user_id: currentUser.id,
        title,
        subject_id: subjectId,
        due_date: dueDate

      });


    if (error) {

      toast(error.message);

      return;

    }


    toast("할 일이 추가되었습니다.");

  }


  $("#todo-modal").classList.add("hidden");

  await loadTodos();

}


async function toggleTodo(id, completed) {

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

    toast(error.message);

    return;

  }


  await loadTodos();

}


async function deleteTodo(id) {

  if (!confirm("이 할 일을 삭제할까요?")) {

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

    toast(error.message);

    return;

  }


  await loadTodos();

  toast("삭제되었습니다.");

}


/* =========================================================
   RANKING
========================================================= */

async function loadHomeRanking() {

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

    console.error(error);

    $("#home-ranking").innerHTML =
      `<div class="empty-state">
        랭킹을 불러오지 못했습니다.
      </div>`;

    return;

  }


  const list =
    (data || []).slice(0, 5);


  if (!list.length) {

    $("#home-ranking").innerHTML =
      `<div class="empty-state">
        같은 반 친구가 아직 없습니다.
      </div>`;

    return;

  }


  $("#home-ranking").innerHTML =
    list.map(
      (item, index) =>
        rankingRow(item, index)
    ).join("");

}


async function loadRanking() {

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

    console.error(error);

    $("#ranking-list").innerHTML =
      `<div class="empty-state">
        랭킹을 불러오지 못했습니다.
      </div>`;

    return;

  }


  const list =
    data || [];


  if (!list.length) {

    $("#ranking-list").innerHTML =
      `<div class="empty-state">
        같은 반 친구가 없습니다.
      </div>`;

    return;

  }


  $("#ranking-list").innerHTML =
    list.map(
      (item, index) =>
        rankingRow(item, index)
    ).join("");

}


function rankingRow(item, index) {

  const medal =
    index === 0
      ? "🥇"
      : index === 1
        ? "🥈"
        : index === 2
          ? "🥉"
          : `${index + 1}`;


  const isMe =
    currentUser &&
    item.user_id === currentUser.id;


  return `

    <div class="rank-row ${
      isMe ? "me-row" : ""
    }">

      <div class="rank-number">
        ${medal}
      </div>

      <div class="rank-name">
        ${escapeHtml(item.name)}
        ${isMe ? " (나)" : ""}
      </div>

      <div class="rank-time">
        ${formatSeconds(
          Number(item.total_seconds || 0)
        )}
      </div>

    </div>

  `;

}


/* =========================================================
   STATISTICS
========================================================= */

async function loadStatistics() {

  const sessions =
    await getOwnSessions();


  const now =
    new Date();


  const todaySeconds =
    sessions
      .filter(
        s => isSameDayKST(s.started_at)
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );


  const weekStart =
    getWeekStartKST();


  const weekSeconds =
    sessions
      .filter(
        s =>
          new Date(s.started_at)
            >= weekStart
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );


  const monthStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );


  const monthSeconds =
    sessions
      .filter(
        s =>
          new Date(s.started_at)
            >= monthStart
      )
      .reduce(
        (sum, s) =>
          sum + sessionSeconds(s),
        0
      );


  const totalSeconds =
    sessions.reduce(
      (sum, s) =>
        sum + sessionSeconds(s),
      0
    );


  $("#stat-today").textContent =
    formatShortDuration(todaySeconds);

  $("#stat-week").textContent =
    formatShortDuration(weekSeconds);

  $("#stat-month").textContent =
    formatShortDuration(monthSeconds);

  $("#stat-total").textContent =
    formatShortDuration(totalSeconds);


  renderWeeklyChart(sessions);

  renderSubjectStats(sessions);

}


function renderWeeklyChart(sessions) {

  const start =
    getWeekStartKST();


  const days = [];

  for (let i = 0; i < 7; i++) {

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
        day.toLocaleDateString(
          "en-CA"
        );

      return sessions
        .filter(
          s =>
            dateKST(s.started_at) === key
        )
        .reduce(
          (sum, s) =>
            sum + sessionSeconds(s),
          0
        );

    });


  const max =
    Math.max(
      ...values,
      1
    );


  const labels =
    ["월", "화", "수", "목", "금", "토", "일"];


  $("#weekly-chart").innerHTML =
    values.map(
      (value, index) => {

        const height =
          Math.max(
            3,
            (value / max) * 160
          );


        return `

          <div class="bar-column">

            <span class="bar-value">
              ${formatShortDuration(value)}
            </span>

            <div
              class="bar"
              style="height:${height}px"
            ></div>

            <span class="bar-day">
              ${labels[index]}
            </span>

          </div>

        `;

      }
    ).join("");

}


function renderSubjectStats(sessions) {

  const totals = {};


  sessions.forEach(session => {

    const id =
      session.subject_id || "none";

    totals[id] =
      (totals[id] || 0)
      + sessionSeconds(session);

  });


  const entries =
    Object.entries(totals)
      .sort(
        (a, b) => b[1] - a[1]
      );


  if (!entries.length) {

    $("#subject-stats").innerHTML =
      `<div class="empty-state">
        아직 공부 기록이 없습니다.
      </div>`;

    return;

  }


  const max =
    entries[0][1];


  $("#subject-stats").innerHTML =
    entries.map(
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
            ? (seconds / max) * 100
            : 0;


        return `

          <div class="subject-stat-row">

            <div class="subject-stat-top">

              <span>
                ${escapeHtml(name)}
              </span>

              <strong>
                ${formatShortDuration(seconds)}
              </strong>

            </div>

            <div class="progress">

              <div
                class="progress-fill"
                style="
                  width:${percent}%;
                  background:${color};
                "
              ></div>

            </div>

          </div>

        `;

      }
    ).join("");

}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(pageName) {

  $$(".page").forEach(page => {

    page.classList.remove("active");

  });


  const page =
    $(`#page-${pageName}`);

  if (page) {

    page.classList.add("active");

  }


  $$(".nav-btn").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === pageName
    );

  });


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  if (pageName === "ranking") {

    loadRanking();

  }


  if (pageName === "statistics") {

    loadStatistics();

  }


  if (pageName === "todos") {

    loadTodos();

  }


  if (pageName === "settings") {

    loadProfile();
    loadSubjects();

  }


  if (pageName === "study") {

    loadSubjects();

  }


  if (pageName === "home") {

    refreshDashboard();

  }

}


/* =========================================================
   MODALS
========================================================= */

function openStudySubjectModal() {

  $("#study-subject-modal")
    .classList.remove("hidden");

}


function closeModal(id) {

  $(`#${id}`)
    ?.classList.add("hidden");

}


/* =========================================================
   EVENT BINDINGS
========================================================= */

function bindEvents() {

  $("#login-btn")
    .addEventListener(
      "click",
      login
    );


  $("#signup-btn")
    .addEventListener(
      "click",
      signup
    );


  $("#logout-btn")
    .addEventListener(
      "click",
      logout
    );


  $("#show-signup-btn")
    .addEventListener(
      "click",
      showSignupForm
    );


  $("#show-login-btn")
    .addEventListener(
      "click",
      showLoginForm
    );


  $("#home-start-btn")
    .addEventListener(
      "click",
      () => {

        if (!selectedSubjectId) {

          openStudySubjectModal();

          return;

        }

        startStudy();

      }
    );


  $("#study-start-btn")
    .addEventListener(
      "click",
      () => {

        if (!selectedSubjectId) {

          openStudySubjectModal();

          return;

        }

        startStudy();

      }
    );


  $("#study-finish-btn")
    .addEventListener(
      "click",
      finishStudy
    );


  $("#add-subject-btn")
    .addEventListener(
      "click",
      openAddSubject
    );


  $("#add-subject-from-study")
    .addEventListener(
      "click",
      openAddSubject
    );


  $("#save-subject-btn")
    .addEventListener(
      "click",
      saveSubject
    );


  $("#add-todo-btn")
    .addEventListener(
      "click",
      openAddTodo
    );


  $("#save-todo-btn")
    .addEventListener(
      "click",
      saveTodo
    );


  $("#save-profile-btn")
    .addEventListener(
      "click",
      saveProfile
    );


  $$(".nav-btn").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


  $$("[data-page]").forEach(button => {

    if (
      button.classList.contains("nav-btn")
    ) return;

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


  $$(".ranking-period").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $$(".ranking-period")
          .forEach(b =>
            b.classList.remove("active")
          );

        button.classList.add("active");

        currentRankingPeriod =
          button.dataset.period;

        loadRanking();

      }
    );

  });


  $$(".todo-filter-btn").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        $$(".todo-filter-btn")
          .forEach(b =>
            b.classList.remove("active")
          );

        button.classList.add("active");

        currentTodoFilter =
          button.dataset.filter;

        renderTodos();

      }
    );

  });


  $$(".modal-close").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        closeModal(
          button.dataset.close
        );

      }
    );

  });


  $$(".color-option").forEach(button => {

    button.addEventListener(
      "click",
      () => {

        selectedColor =
          button.dataset.color;

        $$(".color-option")
          .forEach(b =>
            b.classList.remove("selected")
          );

        button.classList.add("selected");

      }
    );

  });


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        $$(".modal")
          .forEach(modal =>
            modal.classList.add("hidden")
          );

      }

    }
  );


  supabase.auth.onAuthStateChange(
    async (event, session) => {

      if (
        event === "SIGNED_IN" &&
        session?.user
      ) {

        currentUser =
          session.user;

        await startApp();

      }


      if (
        event === "SIGNED_OUT"
      ) {

        currentUser = null;

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
    .classList.add("hidden");

  $("#signup-form")
    .classList.remove("hidden");

}


function showLoginForm() {

  $("#signup-form")
    .classList.add("hidden");

  $("#login-form")
    .classList.remove("hidden");

}


/* =========================================================
   HELPERS
========================================================= */

function setTimerText(
  element,
  seconds
) {

  element.textContent =
    formatSeconds(seconds);

}


function formatSeconds(seconds) {

  seconds =
    Math.max(
      0,
      Math.floor(seconds || 0)
    );


  const hours =
    Math.floor(
      seconds / 3600
    );


  const minutes =
    Math.floor(
      (seconds % 3600) / 60
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
          .padStart(2, "0")
    )
    .join(":");

}


function formatShortDuration(seconds) {

  seconds =
    Math.max(
      0,
      Math.floor(seconds || 0)
    );


  const hours =
    Math.floor(
      seconds / 3600
    );


  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );


  if (hours > 0) {

    return `${hours}시간 ${minutes}분`;

  }


  return `${minutes}분`;

}


function escapeHtml(value) {

  if (value === null || value === undefined) {

    return "";

  }


  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


let toastTimeout = null;

function toast(message) {

  const element =
    $("#toast");

  $("#toast-message").textContent =
    message;

  element.classList.add("show");


  clearTimeout(toastTimeout);


  toastTimeout =
    setTimeout(
      () => {

        element.classList.remove("show");

      },
      3000
    );

}


/* =========================================================
   EXPOSE FUNCTIONS FOR INLINE HTML
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


/* =========================================================
   PAGE VISIBILITY
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      !document.hidden &&
      currentUser
    ) {

      restoreActiveSession();

    }

  }
);
