document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById("blog-info-modal");
  var btn = document.getElementById("blog-info-btn");
  var span = document.getElementsByClassName("close")[0];

  // 페이지 로드 시 모달을 숨김
  modal.style.display = "none";

  // 버튼 클릭 시 모달 열기
  btn.onclick = function() {
      modal.style.display = "block";
  }

  // 모달 밖을 클릭 시 모달 닫기
  window.onclick = function(event) {
      if (event.target == modal) {
          modal.style.display = "none";
      }
  }
});
