document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById("blog-info-modal");
  var btn = document.getElementById("blog-info-btn");
  var span = document.getElementsByClassName("close")[0];

  btn.onclick = function() {
    modal.style.display = "block";
  }

  span.onclick = function() {
    modal.style.display = "none";
  }

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  }
});
