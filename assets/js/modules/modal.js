export function initModal() {
    var modal = document.getElementById("blog-info-modal");
    var btn = document.getElementById("blog-info-btn");
    var span = document.querySelector(".modal-close");

    if (!modal || !btn) {
        console.log('Modal elements not found');
        return;
    }

    btn.onclick = function() {
        modal.style.display = "flex";
    }

    if(span) {
        span.onclick = function() {
            modal.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}
