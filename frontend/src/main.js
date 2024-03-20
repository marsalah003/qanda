import { BACKEND_PORT } from "./config.js";
// A helper you may want to use when uploading new images to the server.
import {
  fileToDataUrl,
  getRelativeTimeString,
  request,
  displayError,
  getToken,
  getUserId,
  removeToken,
  setToken,
  displayNav,
} from "./helpers.js";

const pages = ["login", "register", "dashboard"];
const subpages = ["create-thread"];
let intervalId;
let page = 0;
/*
    Helper functions
*/
const goToPage = (page) => {
  if (["login", "register"].includes(page)) {
    displayNav("nav");
    clearInterval(intervalId);

    document.querySelector(".header-user-name").innerText = "";
  } else {
    displayNav("auth-nav");
  }

  if (page === "dashboard") return goToSubpage("dashboard");
  document
    .querySelectorAll("main > .page")
    .forEach((page) => (page.style.display = "none"));
  document.querySelector(`#${page}-page`).style.display =
    page === "auth" ? "flex" : "block";
};

const goToSubpage = (subpage) => {
  request(`user?userId=${getUserId()}`, "GET", "", token).then(
    ({ email }) =>
      (document.querySelector(".header-user-name").innerText = email)
  );
  if (!document.querySelector(`#${subpage}-subpage`).style.display) {
    displayThreads(page);
  }
  clearInterval(intervalId);
  intervalId = setInterval(() => {
    displayThreads(page);
  }, 1000 * 30);
  goToPage("auth");

  document
    .querySelectorAll("#main-content > .subpage")
    .forEach((subpage) => (subpage.style.display = "none"));

  document.querySelector(`#${subpage}-subpage`).style.display = "flex";
};
const displayThreads = (start, threadsToInclude) => {
  document.querySelector("#thread-list").innerHTML = "";

  return new Promise((resolve) =>
    request(`threads?start=${start}`, "GET", "", token).then((data) => {
      if (data.length === 0) resolve("No threads left to display");
      const threadIdPromises = [];
      for (const threadId of data) {
        if (threadsToInclude)
          if (!threadsToInclude.includes(threadId)) continue;
        threadIdPromises.push(
          request(`thread?id=${threadId}`, "GET", "", token)
        );
      }

      Promise.all(threadIdPromises).then((data) =>
        data.forEach(({ creatorId, title, createdAt, likes, id, name }) => {
          request(`user?userId=${creatorId} `, "GET", "", token)
            .then(({ name }) => {
              const card = document
                .querySelector(".thread-card")
                .cloneNode(true);
              card.style.display = "block";
              card.querySelector(".card-header").innerText = title;
              card.querySelector(".card-id").innerText = id;
              request(`user?userId=${creatorId}`, "GET", "", token).then(
                ({ email }) =>
                  (card.querySelector(".card-creator-name").innerText = name)
              );

              card.querySelector(".card-text").innerText = `${createdAt}| ${
                likes.length
              } like${likes.length === 1 ? "" : "s"} `;
              card.style.background = "grey";
              document.querySelector("#thread-list").appendChild(card);
              resolve("Success");
              card.addEventListener("click", (e) => {
                request(`thread?id=${id}`, "GET", "", token).then(
                  ({ title, content, likes, id }) => {
                    document
                      .querySelectorAll(".thread-card")
                      .forEach((e) => (e.style.background = "grey"));
                    card.style.background = "yellow";
                    viewThread(id, getUserId());
                  }
                );
              });
            })

            .then(() => {
              const list = document.querySelector("#thread-list");
              [...list.children]
                .sort((a, b) => {
                  const date1 = new Date(
                    a.querySelector(".card-text").innerText.split("|")[0]
                  );

                  const date2 = new Date(
                    b.querySelector(".card-text").innerText.split("|")[0]
                  );
                  return date2.getTime() - date1.getTime();
                })
                .forEach((node) => {
                  list.appendChild(node);
                });
            })
            .then(() => {
              document
                .querySelectorAll(".card-creator-name")
                .forEach((el) =>
                  el.removeEventListener("click", handleUserNameClick)
                );
              document
                .querySelectorAll(".card-creator-name")
                .forEach((el) =>
                  el.addEventListener("click", handleUserNameClick)
                );
            });
        })
      );
    })
  );
};
const handleUserNameClick = (e) => {
  e.stopPropagation();

  request();
  goToSubpage("user");
};

const createComment = ({
  content,
  creatorId,
  id,
  parentCommentId,
  createdAt,
  likes,
  name,
}) => {
  const card = document
    .querySelector(".comment-thread-container")
    .cloneNode(true);

  card.style.display = "block";

  card.querySelector(".card-title").innerText = `replied to ${parentCommentId}`;

  card.querySelector(".card-id").innerText = ` comment id: ${id}`;

  card.querySelector(".card-likes").innerText = likes.length;

  card.querySelector("#like-card").style.background = likes.includes(
    getUserId()
  )
    ? "red"
    : "white";

  request(`user?userId=${creatorId}`, "GET", "", token).then(
    ({ image, name }) => {
      card.querySelector(".card-creator-name").innerText = name;
      card.querySelector("#card-img").src = image;
    }
  );
  const rtf = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });
  const dateFromNow = getRelativeTimeString(new Date(createdAt));
  card.querySelector(
    ".card-text"
  ).innerText = `content: ${content}, this comment was created: ${dateFromNow} `;

  card.querySelector(".card-body").style.flexDirection = "column";
  return card;
};

const handleViewCommentReplies = (comment, threadId) =>
  comment.addEventListener("click", (e) => {
    if (!Array.from(e.target.classList).includes("see-card-replies")) return;
    const parentCommentContainer = e.target.closest(
      ".comment-thread-container"
    );
    const commentReplyingTo = e.target.closest(".thread-card");
    if (!commentReplyingTo) return;

    const commentId = commentReplyingTo
      .querySelector(".card-id")
      .innerText.split(" ")[2];

    if (parentCommentContainer.childElementCount > 1)
      return parentCommentContainer
        .querySelectorAll(".comment-thread-container")
        .forEach((el) => {
          parentCommentContainer.removeChild(el);
        });

    request(`comments?threadId=${threadId}`, "GET", "", token).then(
      (comments) =>
        comments
          .filter((comment) => comment.parentCommentId == commentId)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .forEach((comment) => {
            const newComment = createComment(comment);

            const commentReplyingTo = parseInt(
              getComputedStyle(parentCommentContainer).marginLeft
            );

            newComment.style.marginLeft = commentReplyingTo + 30 + "px";
            parentCommentContainer.appendChild(newComment);

            handleCommentReply(newComment);
            handleCommentEdit(newComment);
            handleCommentLike(newComment);
          })
    );
  });

const handleCommentLike = (comment) => {
  comment.querySelector("#like-card").addEventListener("click", (e) => {
    const commentId = e.target
      .closest(".thread-card")
      .querySelector(".card-id")
      .innerText.split(" ")[2];

    const isLiked = !(e.target.style.background === "red");

    request(
      "comment/like",
      "PUT",
      { id: commentId, turnon: isLiked },
      token
    ).then(() => {
      e.target.style.background = isLiked ? "red" : "white";
      const likes = parseInt(
        e.target.closest(".thread-card").querySelector(".card-likes").innerText
      );

      e.target.closest(".thread-card").querySelector(".card-likes").innerText =
        likes + (isLiked ? 1 : -1);
    });
  });
};
const handleCommentEdit = (comment) => {
  comment.querySelector("#edit-card").addEventListener("click", (e) => {
    const commentId = e.target
      .closest(".thread-card")
      .querySelector(".card-id")
      .innerText.split(" ")[2];
    document.querySelector("#comment-model").style.display = "block";
    document.querySelector(".comment-btn").addEventListener("click", (e) => {
      const content = document.querySelector("#comment-text").value;
      const threadId = document.querySelector(".view-thread-id").innerText;

      request("comment", "PUT", { id: commentId, content }, token).then(() => {
        comment.querySelector(".card-text").innerText = content;
        const modal = document.querySelector("#comment-model");
        modal.style.display = "none";
        modal.parentNode.replaceChild(modal.cloneNode(true), modal);
      });
    });
  });
};
const handleCommentReply = (comment) => {
  comment.querySelector("#reply-to-card").addEventListener("click", (e) => {
    document.querySelector("#comment-model").style.display = "block";

    const commentReplyingTo = e.target.closest(".thread-card");
    const seeRepliesElement =
      commentReplyingTo.querySelector(".see-card-replies");
    const parentCommentId = commentReplyingTo
      .querySelector(".card-id")
      .innerText.split(" ")[2];

    document.querySelector(".comment-btn").addEventListener("click", (e) => {
      const content = document.querySelector("#comment-text").value;
      const threadId = document.querySelector(".view-thread-id").innerText;

      request(
        "comment",
        "POST",
        { content, threadId, parentCommentId },
        token
      ).then(() => {
        const modal = document.querySelector("#comment-model");
        modal.style.display = "none";
        if (comment.childElementCount === 1) seeRepliesElement.click();
        else {
          seeRepliesElement.click();
          seeRepliesElement.click();
        }
        modal.parentNode.replaceChild(modal.cloneNode(true), modal);
      });
    });
  });
};
const viewThread = (threadId, userId) =>
  request(`thread?id=${threadId}`, "GET", "", token).then(
    ({ title, content, likes, creatorId, id, watchees }) => {
      document.querySelector("#like-thread-btn").style.background =
        likes.includes(userId) ? "red" : "";

      document.querySelector("#watch-thread-btn").style.background =
        watchees.includes(userId) ? "red" : "";

      document.querySelector("#edit-thread-btn").style.display =
        creatorId === getUserId() ? "flex" : "none";

      document.querySelector("#delete-thread-btn").style.display =
        creatorId === getUserId() ? "flex" : "none";

      request(`comments?threadId=${threadId}`, "GET", "", token).then(
        (comments) => {
          document.querySelector("#comments").innerHTML = "";
          comments
            .filter(({ parentCommentId }) => parentCommentId === null)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .forEach((comment) => {
              const parentCommentContainer = createComment(comment);
              document
                .querySelector("#comments")
                .appendChild(parentCommentContainer);
              handleCommentReply(parentCommentContainer);
              handleCommentEdit(parentCommentContainer);
              handleViewCommentReplies(parentCommentContainer, threadId);
              handleCommentLike(parentCommentContainer);
            });
        }
      );

      document.querySelector(".view-thread-title").innerText = title;
      document.querySelector(".view-thread-creator").innerText = creatorId;

      document.querySelector(".view-thread-content").innerText = content;
      document.querySelector(
        ".view-thread-likes"
      ).innerText = `${likes.length}`;

      document.querySelector(".view-thread-id").innerText = id;

      goToSubpage("view-thread");
    }
  );

/*
    Main program
*/
let token = JSON.parse(localStorage.getItem("token"))?.token;

goToPage(token ? "dashboard" : "login");

document.querySelectorAll("header .normal-link").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const page = link.id.split("-")[0];

    goToPage(page);
  })
);

document.querySelector("#login-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const email = document.querySelector("#login-email").value;
  const password = document.querySelector("#login-password").value;
  request("auth/login", "POST", { email, password })
    .then((data) => {
      setToken(data);
      token = getToken();

      goToPage("dashboard");
    })
    .catch((err) => {
      displayError(err);
    });
});

document.querySelector("#register-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const email = document.querySelector("#register-email").value;
  const name = document.querySelector("#register-name").value;
  const password = document.querySelector("#register-password").value;
  const passwordConfirm = document.querySelector(
    "#register-password-confirm"
  ).value;

  if (password !== passwordConfirm)
    return displayError("Passwords dont match!");
  request("auth/register", "POST", {
    email,
    password,
    name,
  })
    .then((data) => {
      setToken(data);
      token = getToken();
      goToPage("dashboard");
    })

    .catch((err) => {
      displayError(err);
    });
});

document
  .querySelectorAll("div.modal .close")
  .forEach((modal) =>
    modal.addEventListener("click", ({ target }) =>
      document
        .querySelectorAll("div.modal")
        .forEach((modal) => (modal.style.display = "none"))
    )
  );

document.querySelector("#logout-link").addEventListener("click", (e) => {
  e.preventDefault();
  removeToken();
  token = null;
  goToPage("login");
});
document.querySelector("#thread-create-btn").addEventListener("click", () => {
  goToSubpage("create-thread");
});
document.querySelector("#submit-thread-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const title = document.querySelector("#create-thread-title").value;
  const content = document.querySelector("#create-thread-content").value;
  const isPublic = !document.querySelector("#create-thread-private").checked;
  request(
    "thread",
    "POST",
    {
      title,
      isPublic,
      content,
    },
    token
  )
    .then(({ id }) => {
      viewThread(id, getToken());
    })

    .catch((err) => displayError(err));
});

document.querySelector("#edit-thread-btn").addEventListener("click", () => {
  const title = document.querySelector(".view-thread-title").innerText;
  const content = document.querySelector(".view-thread-content").innerText;
  const threadId = document.querySelector(".view-thread-id").innerText;

  request(`thread?id=${threadId}`, "GET", "", token).then(({ isPublic }) => {
    document.querySelector("#edit-thread-title").value = title;
    document.querySelector("#edit-thread-content").value = content;
    document.querySelector("#edit-thread-private").checked = !isPublic;

    goToSubpage("edit-thread");
  });
});
document
  .querySelector("#edit-submit-thread-btn")
  .addEventListener("click", (e) => {
    e.preventDefault();
    const title = document.querySelector("#edit-thread-title").value;
    const content = document.querySelector("#edit-thread-content").value;
    const isPublic = !document.querySelector("#edit-thread-private").checked;
    const threadId = document.querySelector(".view-thread-id").innerText;

    request(
      "thread",
      "PUT",
      { id: threadId, title, isPublic, content },
      token
    ).then(() => viewThread(threadId, getUserId()));
  });

document.querySelector("#delete-thread-btn").addEventListener("click", () => {
  const threadId = document.querySelector(".view-thread-id").innerText;
  request("thread", "DELETE", { id: threadId }, token).then(() =>
    displayThreads(0).then((data) => {
      const threadList = document.querySelector("#thread-list");
      const threadToView = threadList.querySelector(".card-id")?.innerText;
      if (!threadToView) return goToPage("dashboard");
      viewThread(threadToView, getUserId());
    })
  );
});
document.querySelector("#like-thread-btn").addEventListener("click", (e) => {
  const threadId = document.querySelector(".view-thread-id").innerText;
  const turnon = !(
    document.querySelector("#like-thread-btn").style.background === "red"
  );

  request(
    "thread/like",
    "PUT",
    {
      id: threadId,
      turnon,
    },
    token
  ).then(() => viewThread(threadId, getUserId()));
});

document.querySelector("#watch-thread-btn").addEventListener("click", () => {
  const turnon = !(
    document.querySelector("#watch-thread-btn").style.background === "red"
  );
  const threadId = document.querySelector(".view-thread-id").innerText;
  request("thread/watch", "PUT", { id: threadId, turnon }, token).then(() =>
    viewThread(threadId, getUserId())
  );
});
const container = document.querySelector("#thread-list");

document.querySelector("#next-button").addEventListener("click", () => {
  displayThreads(page + 5).then((msg) => {
    msg === "Success" ? (page = page + 5) : displayThreads(page);
  });
});

document.querySelector("#prev-button").addEventListener("click", () => {
  if (page >= 5)
    displayThreads(page - 5).then((msg) => {
      msg === "Success" ? (page = page - 5) : displayThreads(page);
    });
});
document.querySelector("#comment-btn").addEventListener("click", () => {
  const commentText = document.querySelector("#comment-text-area").value;
  const threadId = document.querySelector(".view-thread-id").innerText;
  console.log(commentText, threadId);
  request(
    "comment",
    "POST",
    {
      content: commentText,
      threadId,
      parentCommentId: null,
    },
    token
  ).then(({ id }) => {
    console.log("hey");
    viewThread(threadId, getUserId());
  });
});
