class KeyPressListener {
  constructor(keyCode, callback) {
    let keySafe = true;

    this.keydownFunction = function(event) {
      if (event.code === keyCode) {
         if (keySafe) {
            keySafe = false;
            callback();
         }  
      }
    };
    this.keyupFunction = function(event) {
      if (event.code === keyCode) {
         keySafe = true;
      }         
    };

    document.addEventListener("keydown", this.keydownFunction);
    document.addEventListener("keyup", this.keyupFunction);

    // Touch button listener (untuk tombol Enter / Action / A)
    this.touchHandler = (e) => {
      e.preventDefault();
      callback();
    };

    const actionBtn = document.querySelector(".btn-action");
    if (actionBtn && (keyCode === "Enter" || keyCode === "Space")) {
      actionBtn.addEventListener("click", this.touchHandler);
      actionBtn.addEventListener("touchstart", this.touchHandler);
    }
  }

  unbind() { 
    document.removeEventListener("keydown", this.keydownFunction);
    document.removeEventListener("keyup", this.keyupFunction);

    const actionBtn = document.querySelector(".btn-action");
    if (actionBtn) {
      actionBtn.removeEventListener("click", this.touchHandler);
      actionBtn.removeEventListener("touchstart", this.touchHandler);
    }
  }
}