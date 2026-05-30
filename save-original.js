(() => {
  const photoInput = document.querySelector("#photoInput");
  const clearPhotoButton = document.querySelector("#clearPhotoButton");
  const composedLink = document.querySelector("#downloadLink");
  const originalLink = document.querySelector("#originalDownloadLink");
  const boardPosition = document.querySelector("#boardPosition");
  if (!photoInput || !clearPhotoButton || !composedLink || !originalLink) return;

  let originalUrl = "";
  let originalName = "";

  function sanitizeFileName(value) {
    return String(value || "photo").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 48) || "photo";
  }

  function makeOriginalName() {
    const composedBase = (composedLink.download || "electronic-board-photo.jpg").replace(/\.[^.]+$/, "");
    const sourceName = sanitizeFileName(originalName || "source-photo.jpg");
    const extension = sourceName.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg";
    const sourceBase = sourceName.replace(/\.[^.]+$/, "").slice(0, 28) || "source-photo";
    return `${composedBase}_合成前_${sourceBase}${extension}`;
  }

  function disableOriginalLink() {
    originalLink.removeAttribute("href");
    originalLink.setAttribute("aria-disabled", "true");
  }

  function setDefaultBoardPosition() {
    if (!boardPosition) return;
    if (boardPosition.value && boardPosition.value !== "bottom-left") return;
    boardPosition.value = "bottom-right";
    boardPosition.dispatchEvent(new Event("change"));
  }

  disableOriginalLink();
  setDefaultBoardPosition();
  window.addEventListener("DOMContentLoaded", setDefaultBoardPosition);
  setTimeout(setDefaultBoardPosition, 100);
  setTimeout(setDefaultBoardPosition, 500);

  photoInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = URL.createObjectURL(file);
    originalName = file.name;
    originalLink.href = originalUrl;
    originalLink.download = makeOriginalName();
    originalLink.setAttribute("aria-disabled", "false");
  });

  originalLink.addEventListener("click", (event) => {
    if (!originalUrl) {
      event.preventDefault();
      return;
    }
    originalLink.download = makeOriginalName();
  });

  clearPhotoButton.addEventListener("click", () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    originalUrl = "";
    originalName = "";
    disableOriginalLink();
  });
})();
