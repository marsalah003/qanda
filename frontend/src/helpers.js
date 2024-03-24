/**
 * Given a js file object representing a jpg or png image, such as one taken
 * from a html file input element, return a promise which resolves to the file
 * data as a data url.
 * More info:
 *   https://developer.mozilla.org/en-US/docs/Web/API/File
 *   https://developer.mozilla.org/en-US/docs/Web/API/FileReader
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
 *
 * Example Usage:
 *   const file = document.querySelector('input[type="file"]').files[0];
 *   console.log(fileToDataUrl(file));
 * @param {File} file The file to be read.
 * @return {Promise<string>} Promise which resolves to the file as a data url.
 */
function fileToDataUrl(file) {
  const validFileTypes = ["image/jpeg", "image/png", "image/jpg"];
  const valid = validFileTypes.find((type) => type === file.type);
  // Bad data, let's walk away.
  if (!valid) {
    throw Error("provided file is not a png, jpg or jpeg image.");
  }

  const reader = new FileReader();
  const dataUrlPromise = new Promise((resolve, reject) => {
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
  });
  reader.readAsDataURL(file);
  return dataUrlPromise;
}

const getRelativeTimeString = (date, lang = navigator.language) => {
  // Allow dates or times to be passed
  const timeMs = typeof date === "number" ? date : date.getTime();

  // Get the amount of seconds between the given date and now
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);

  // Array reprsenting one minute, hour, day, week, month, etc in seconds
  const cutoffs = [
    60,
    3600,
    86400,
    86400 * 7,
    86400 * 30,
    86400 * 365,
    Infinity,
  ];

  // Array equivalent to the above but in the string representation of the units
  const units = ["second", "minute", "hour", "day", "week", "month", "year"];

  // Grab the ideal cutoff unit
  const unitIndex = cutoffs.findIndex(
    (cutoff) => cutoff > Math.abs(deltaSeconds)
  );

  // Get the divisor to divide from the seconds. E.g. if our unit is "day" our divisor
  // is one day in seconds, so we can divide our seconds by this to get the # of days
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;

  // Intl.RelativeTimeFormat do its magic
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
};
const request = (path, method, body, token) =>
  fetch(`http://localhost:5005/` + path, {
    method,
    headers: {
      "Content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body && { body: JSON.stringify(body) }),
  })
    .catch((err) => displayError(err))
    .then((res) => {
      try {
        return res.json();
      } catch (error) {
        return Promise.reject(error);
      }
    })
    .then((data) =>
      data.error ? Promise.reject(data.error) : Promise.resolve(data)
    );

const setToken = (token) =>
  localStorage.setItem("token", JSON.stringify(token));

const getToken = () => JSON.parse(localStorage.getItem("token")).token;

const getUserId = () => JSON.parse(localStorage.getItem("token")).userId;
const removeToken = () => localStorage.removeItem("token");

const displayError = (err) => {
  const myModal = new bootstrap.Modal("#err-modal", {
    keyboard: false,
  });
  document.querySelector("#err-modal").querySelector("p").innerText = err;
  myModal.show();
};

const displayNav = (navType) => {
  document
    .querySelectorAll(".nav, .auth-nav")
    .forEach((nav) => (nav.style.display = "none"));
  console.log(navType);
  document.querySelectorAll(`.${navType}`).forEach((element) => {
    element.style.display = "block";
  });
};

export {
  fileToDataUrl,
  getRelativeTimeString,
  request,
  setToken,
  displayError,
  getToken,
  getUserId,
  removeToken,
  displayNav,
};
