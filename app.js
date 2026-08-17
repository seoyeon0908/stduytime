async function signup() {

  const name = $("#signup-name").value.trim();
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;
  const school = $("#signup-school").value.trim();

  const grade = Number($("#signup-grade").value);
  const classNumber = Number($("#signup-class").value);

  // 입력 검사
  if (!name) {
    toast("이름 또는 닉네임을 입력해주세요.");
    return;
  }

  if (!email) {
    toast("이메일을 입력해주세요.");
    return;
  }

  if (!password) {
    toast("비밀번호를 입력해주세요.");
    return;
  }

  if (password.length < 6) {
    toast("비밀번호는 6자 이상이어야 합니다.");
    return;
  }

  if (!school) {
    toast("학교를 입력해주세요.");
    return;
  }

  if (!grade || grade < 1) {
    toast("학년을 선택해주세요.");
    return;
  }

  if (!classNumber || classNumber < 1) {
    toast("반을 입력해주세요.");
    return;
  }

  const button = $("#signup-btn");

  button.disabled = true;
  button.textContent = "가입 중...";

  try {

    const {
      data,
      error
    } = await supabase.auth.signUp({

      email,
      password,

      options: {
        data: {
          name: name,
          school: school,
          grade: grade,
          class_number: classNumber
        }
      }

    });

    if (error) {

      console.error("회원가입 오류:", error);

      toast(
        "회원가입 실패: " +
        error.message
      );

      return;
    }

    if (!data || !data.user) {

      toast("회원가입에 실패했습니다.");

      return;
    }

    /*
     * Supabase의 회원가입 트리거가
     * profiles를 자동으로 생성하도록 되어 있다.
     *
     * 그래도 혹시 생성되지 않은 경우를 대비해서
     * 아래에서 한 번 확인한다.
     */

    currentUser = data.user;

    if (data.session) {

      await createProfileIfNeeded({
        id: data.user.id,
        name: name,
        school: school,
        grade: grade,
        class_number: classNumber
      });

      await createDefaultSubjects();

      toast("회원가입이 완료되었습니다!");

      await startApp();

    } else {

      /*
       * 이메일 확인 기능이 켜져 있는 경우
       */

      toast(
        "가입 완료! 이메일을 확인한 뒤 로그인해주세요."
      );

      showLoginForm();

      $("#login-email").value = email;
    }

  } catch (err) {

    console.error("회원가입 예외:", err);

    toast(
      "회원가입 중 문제가 발생했습니다."
    );

  } finally {

    button.disabled = false;
    button.textContent = "회원가입";

  }

}
