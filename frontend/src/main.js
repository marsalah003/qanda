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
let currentThread = localStorage.getItem("currentThread") || null;
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

  if (page === "dashboard") {
    return goToSubpage("dashboard");
  }
  document
    .querySelectorAll("main > .page")
    .forEach((page) => (page.style.display = "none"));
  document.querySelector(`#${page}-page`).style.display =
    page === "auth" ? "flex" : "block";
};

const goToSubpage = (subpage) => {
  request(`user?userId=${getUserId()}`, "GET", "", token).then(
    ({ email, image, name }) => {
      document.querySelector(".header-user-name").innerText = name;
      if (image) document.querySelector(".profile_img").src = image;
    }
  );

  if (subpage === "dashboard") displayThreads(page);

  clearInterval(intervalId);
  intervalId = setInterval(() => {
    displayThreads(page);
  }, 1000 * 150);
  goToPage("auth");
  document
    .querySelectorAll(".hide-by-default")
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll("#main-content > .subpage")
    .forEach((subpage) => (subpage.style.display = "none"));

  document.querySelector(`#${subpage}-subpage`).style.display = "flex";
};

const displayThreads = (start, dontRemove = false, threadsToInclude) => {
  if (!dontRemove) {
    console.log("hey");
    document.querySelector("#thread-list").innerHTML = "";
    document.querySelector("#load-more-threads-btn").style.display = "block";
    document.querySelector("#thread-create-btn").style.display = "block";
    page = 0;
    start = 0;
  }

  return new Promise((resolve) =>
    request(`threads?start=${start}`, "GET", "", token).then((data) => {
      if (data.length === 0) resolve({ success: false, num: 0 });
      const threadIdPromises = [];
      for (const threadId of threadsToInclude ? threadsToInclude : data) {
        threadIdPromises.push(
          request(`thread?id=${threadId}`, "GET", "", token)
        );
      }
      Promise.all(threadIdPromises).then((data) => {
        data.forEach(({ creatorId, title, createdAt, likes, id }) =>
          request(`user?userId=${creatorId} `, "GET", "", token)
            .then(({ name }) => {
              const card = document
                .querySelector(".thread-card")
                .cloneNode(true);

              card.style.display = "block";
              card.querySelector(".card-title").innerText = title;
              card.querySelector(".card-id").innerText = id;
              card.querySelector(".card-creator-name").innerText = name;

              card.querySelector(".card-timestamp").innerText = createdAt;
              card.querySelector(".card-user-id").innerText = creatorId;

              card.querySelector(".card-thread-created").innerText =
                getRelativeTimeString(new Date(createdAt));

              card.querySelector(".card-no-likes").innerText = likes.length;

              request(`comments?threadId=${id}`, "GET", "", token)
                .then(
                  (comments) =>
                    (card.querySelector(".card-no-comments").innerText =
                      comments.length)
                )
                .catch((err) => displayError(err));

              document.querySelector("#thread-list").appendChild(card);
              resolve({ success: true, num: data.length });
              card.addEventListener("click", (e) => {
                document
                  .querySelectorAll(".list-group-item")
                  .forEach((e) => e.classList.remove("active"));
                card
                  .querySelector(".list-group-item")
                  .classList.toggle("active");
                viewThread(id, getUserId());
              });
            })
            .then(() => {
              document
                .querySelectorAll(".card-creator-name")
                .forEach((el) =>
                  el.addEventListener("click", handleUserNameClick)
                );
            })
            .then(() => {
              const list = document.querySelector("#thread-list");
              [...list.children]
                .sort((a, b) => {
                  const date1 = new Date(
                    a.querySelector(".card-timestamp").innerText
                  );

                  const date2 = new Date(
                    b.querySelector(".card-timestamp").innerText
                  );
                  return date2.getTime() - date1.getTime();
                })
                .forEach((node) => list.appendChild(node));
            })
        );
      });
    })
  );
};
const getAllUserThreads = (userId) =>
  getAllThreads().then((threadIds) => {
    const promises = [];
    for (const threadId of threadIds) {
      promises.push(request(`thread?id=${threadId}`, "GET", "", token));
    }
    return Promise.all(promises).then((threads) =>
      threads.filter(({ creatorId }) => creatorId == userId).map(({ id }) => id)
    );
  });
const getAllThreadIdsRecursive = (start) =>
  new Promise((resolve) =>
    request(`threads?start=${start}`, "GET", "", token).then((threadIds) => {
      if (threadIds.length === 0) return resolve(threadIds);
      getAllThreadIdsRecursive(start + 5).then((data) =>
        resolve([...data, ...threadIds])
      );
    })
  );
const getAllThreads = () => getAllThreadIdsRecursive(0);
const handleUserNameClick = (e) => {
  let targetUserId;
  if (typeof e === "object") {
    e.stopPropagation();
    targetUserId = e.target.nextElementSibling.innerText;
  } else {
    targetUserId = e;
  }

  const isOwnProfile = targetUserId == getUserId();

  const promises = [];
  promises.push(request(`user?userId=${targetUserId}`, "GET", "", token));
  promises.push(request(`user?userId=${getUserId()}`, "GET", "", token));

  Promise.all(promises).then(
    ([
      { admin: isTargetAdmin, name, email, image },
      { admin: isUserAdmin },
    ]) => {
      console.log(isOwnProfile);

      if (isUserAdmin && !isOwnProfile) {
        document
          .querySelector("#user-permission-btn")
          .addEventListener("click", (e) => {
            const updatedRole = document.querySelector(
              ".user-permission-select"
            ).value;
            request(
              `user/admin`,
              "PUT",
              {
                turnon: updatedRole === "admin",
                userId: targetUserId,
              },
              token
            );
          });
        document.querySelector(".user-permission-change").style.display =
          "block";
        document.querySelector(".user-permission-select").value = isTargetAdmin
          ? "admin"
          : "user";
      }

      document.querySelector(".user-email").innerText = email;
      document.querySelector(".user-name").innerText = name;

      document.querySelector(".user-img").src = image;
      document.querySelector("#user-threads");
      goToSubpage("user");

      if (isOwnProfile)
        document.querySelector("#user-form").style.display = "block";

      document.querySelector("#thread-create-btn").style.display = "none";
      document.querySelector("#load-more-threads-btn").style.display = "none";

      getAllUserThreads(targetUserId).then((threads) => {
        document.querySelector("#thread-list").innerHTML = "";
        displayThreads(0, true, threads);
      });
    }
  );
};

const createComment = (
  { content, creatorId, id, parentCommentId, createdAt, likes, name },
  threadId
) =>
  new Promise((resolve) => {
    const card = document
      .querySelector(".comment-thread-container")
      .cloneNode(true);

    const promises = [];
    promises.push(request(`thread?id=${threadId}`, "GET", "", token));
    promises.push(request(`comments?threadId=${threadId}`, "GET", "", token));

    Promise.all(promises).then(([{ lock }, comments]) => {
      card.style.display = "block";
      const disableWhenLocked = [
        "#edit-card",
        ".reply-to-card",
        "#like-btn",
        ".remove-card-btn",
      ];
      const replies = comments.filter(
        ({ parentCommentId }) => parentCommentId == id
      );
      if (replies.length === 0)
        card.querySelector(".see-card-replies").style.display = "none";
      disableWhenLocked.forEach((el) => {
        card.querySelector(el).removeAttribute("disabled");
      });

      card.querySelector(".parent").innerText = parentCommentId;
      card.querySelector(".card-id").innerText = id;
      card.querySelector(".card-user-id").innerText = creatorId;
      card.querySelector(".card-likes").innerText = likes.length;
      const isLiked = likes.includes(getUserId());
      card.querySelector(".like-btn-text").innerText = isLiked
        ? "Unlike"
        : "Like";

      card.querySelector(".bi-heart-fill").style.display = isLiked
        ? "inline-block"
        : "none";

      card.querySelector(".bi-heart").style.display = isLiked
        ? "none"
        : "inline-block";

      request(`user?userId=${creatorId}`, "GET", "", token).then(
        ({ image, name }) => {
          card.querySelector(".card-creator-name").innerText = name;
          card
            .querySelector(".card-creator-name")
            .addEventListener("click", handleUserNameClick);
          if (image) card.querySelector(".card-img").src = image;
        }
      );
      const rtf = new Intl.RelativeTimeFormat("en", {
        numeric: "auto",
      });
      const dateFromNow = getRelativeTimeString(new Date(createdAt));
      card.querySelector(".date").innerText = dateFromNow;
      card.querySelector(".card-text").innerText = content;
      if (lock) {
        disableWhenLocked.forEach((el) =>
          card.querySelector(el).setAttribute("disabled", "true")
        );
      }
      resolve(card);
    });
  });

const handleViewCommentReplies = (comment, threadId) => {
  comment
    .querySelector(".see-card-replies")
    .addEventListener("click", ({ target }) => {
      const parentElement = target.closest(".comment-thread-container");

      const commentId = parentElement.querySelector(".card-id").innerText;

      const repliesBtnMessage = target
        .closest(".card-body")
        .querySelector(".replies-btn-message");

      if (parentElement.childElementCount > 1) {
        repliesBtnMessage.innerText = "See Replies";
        return parentElement
          .querySelectorAll(":scope > .comment-thread-container")
          .forEach((el) => parentElement.removeChild(el));
      }

      request(`comments?threadId=${threadId}`, "GET", "", token).then(
        (comments) => {
          const replies = comments.filter(
            (comment) => comment.parentCommentId == commentId
          );
          if (replies.length !== 0) {
            repliesBtnMessage.innerText = "Hide Replies";
          }

          replies
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
            .forEach((commentObj) => {
              createComment(commentObj, threadId).then((newComment) => {
                if (commentObj.creatorId == getUserId()) {
                  newComment.querySelector(".remove-card-btn").style.display =
                    "block";
                  newComment.querySelector("#edit-card").style.display =
                    "block";
                }
                const parentMargin = parseInt(
                  getComputedStyle(comment).marginLeft
                );

                newComment.style.marginLeft = parentMargin + 30 + "px";

                target
                  .closest(".comment-thread-container")
                  .appendChild(newComment);

                handleCommentReply(newComment);
                handleViewCommentReplies(newComment, threadId);
                handleCommentEdit(newComment);
                handleCommentLike(newComment);
                handleCommentRemove(newComment);
              });
            });
        }
      );
    });
};
const removeComment = (id, threadId) =>
  new Promise((resolve) =>
    request("comment", "DELETE", { id }, token)
      .then(() => {
        request(`comments?threadId=${threadId}`, "GET", "", token).then(
          (comments) => {
            const replies = comments.filter(
              ({ parentCommentId }) => parentCommentId == id
            );
            if (replies.length === 0) return resolve();
            replies.forEach(({ id }) =>
              removeComment(id, threadId).then(() => resolve())
            );
          }
        );
      })
      .catch((err) =>
        console.log(`an error occured as a comment was being removed: ${err} `)
      )
  );

const handleCommentRemove = (comment) =>
  comment.querySelector(".remove-card-btn").addEventListener("click", () => {
    const threadId = document.querySelector(".view-thread-id").innerText;
    const commentId = comment.querySelector(".card-id").innerText;
    removeComment(parseInt(commentId), threadId).then(() =>
      viewThread(threadId, getUserId())
    );
  });
const handleCommentLike = (comment) => {
  comment.querySelector("#like-btn").addEventListener("click", (e) => {
    const likedElement = comment.querySelector(".liked");
    const unlikedElement = comment.querySelector(".unliked");

    const commentId = comment.querySelector(".card-id").innerText;

    const isLiked =
      comment.querySelector(".bi-heart-fill").style.display === "inline-block";

    comment.querySelector(".like-btn-text").innerText = isLiked
      ? "Like"
      : "Unlike";

    comment.querySelector(".bi-heart-fill").style.display = isLiked
      ? "none"
      : "inline-block";

    comment.querySelector(".bi-heart").style.display = isLiked
      ? "inline-block"
      : "none";

    request(
      "comment/like",
      "PUT",
      { id: commentId, turnon: !isLiked },
      token
    ).then(() => {
      const likes = parseInt(comment.querySelector(".card-likes").innerText);

      comment.querySelector(".card-likes").innerText =
        likes + (isLiked ? -1 : 1);
    });
  });
};
const handleCommentEdit = (comment) => {
  comment
    .querySelector("#edit-card")
    .addEventListener("click", ({ target }) => {
      const commentId = target
        .closest(".card-body")
        .querySelector(".card-id").innerText;
      document.querySelector(".comment-modal-replying-to").innerText =
        "Editing comment";

      document.querySelector("#comment-text").value =
        comment.querySelector(".card-text").innerText;

      const myModal = new bootstrap.Modal("#comment-modal", {
        keyboard: false,
      });
      myModal.show();
      document.querySelector(".comment-btn").addEventListener("click", (e) => {
        const content = document.querySelector("#comment-text").value;
        const threadId = document.querySelector(".view-thread-id").innerText;

        request("comment", "PUT", { id: commentId, content }, token).then(
          () => {
            comment.querySelector(".card-text").innerText = content;
            const modal = document.querySelector("#comment-modal");

            myModal.hide();
            modal.style.display = "none";
            modal.parentNode.replaceChild(modal.cloneNode(true), modal);
          }
        );
      });
    });
};
const handleCommentReply = (comment) => {
  comment.querySelector(".reply-to-card").addEventListener("click", (e) => {
    const myModal = new bootstrap.Modal("#comment-modal", {
      keyboard: false,
    });
    myModal.show();
    const nameReplyingTo =
      comment.querySelector(".card-creator-name").innerText;
    document.querySelector(
      ".comment-modal-replying-to"
    ).innerText = `Replying to ${nameReplyingTo}`;

    const seeRepliesElement = comment.querySelector(".see-card-replies");
    const parentCommentId = comment.querySelector(".card-id").innerText;
    document.querySelector(".comment-btn").addEventListener("click", (e) => {
      const content = document.querySelector("#comment-text").value;
      const threadId = document.querySelector(".view-thread-id").innerText;
      request(
        "comment",
        "POST",
        { content, threadId, parentCommentId },
        token
      ).then(() => {
        const modal = document.querySelector("#comment-modal");
        myModal.hide();

        if (comment.childElementCount === 1) seeRepliesElement.click();
        else {
          seeRepliesElement.click();
          seeRepliesElement.click();
        }
        modal.parentNode.replaceChild(modal.cloneNode(true), modal);
        viewThread(threadId, getUserId());
      });
    });
  });
};
const viewThread = (threadId, userId) => {
  const promises = [];

  promises.push(request(`thread?id=${threadId}`, "GET", "", token));

  promises.push(request(`comments?threadId=${threadId}`, "GET", "", token));
  promises.push(request(`user?userId=${getUserId()}`, "GET", "", token));
  Promise.all(promises).then(
    ([
      { title, content, likes, creatorId, id, watchees, lock },
      comments,
      { admin },
    ]) =>
      request(`user?userId=${creatorId}`, "GET", "", token).then(({ name }) => {
        const hideWhenLocked = [
          "comment-area",
          "edit-thread-btn",
          "watch-thread-btn",
          "like-thread-btn",
        ];
        hideWhenLocked.forEach(
          (el) => (document.querySelector(`#${el}`).style.display = "block")
        );
        localStorage.setItem("currentThread", threadId);
        document.querySelector(".thread-likes").innerText = likes.length;
        document.querySelector(".view-thread-creator-name").innerText = name;
        document.querySelector("#edit-thread-btn").style.display =
          creatorId == getUserId() || admin ? "block" : "none";
        document
          .querySelectorAll(".heart")
          .forEach((el) => (el.style.display = "none"));

        if (likes.includes(userId)) {
          document.querySelector(
            ".thread-btn-container .bi-heart-fill"
          ).style.display = "inline-block";
        } else {
          document.querySelector(
            ".thread-btn-container .bi-heart"
          ).style.display = "inline-block";
        }

        document.querySelector("#watch-thread-btn").innerText =
          watchees.includes(userId) ? "Unwatch" : "Watch";

        document.querySelector("#delete-thread-btn").style.display =
          creatorId === getUserId() || admin ? "block" : "none";
        if (lock) {
          hideWhenLocked.forEach((el) => {
            document.querySelector(`#${el}`).style.display = "none";
          });
        }

        document.querySelector("#comments").innerHTML = "";
        comments
          .filter(({ parentCommentId }) => parentCommentId === null)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .forEach((comment) => {
            createComment(comment, threadId).then((parentCommentContainer) => {
              if (comment.creatorId == getUserId()) {
                parentCommentContainer.querySelector(
                  ".remove-card-btn"
                ).style.display = "block";
                parentCommentContainer.querySelector(
                  "#edit-card"
                ).style.display = "block";
              }
              document
                .querySelector("#comments")
                .appendChild(parentCommentContainer);
              handleViewCommentReplies(parentCommentContainer, threadId);
              handleCommentReply(parentCommentContainer);
              handleCommentEdit(parentCommentContainer);
              handleCommentLike(parentCommentContainer);
              handleCommentRemove(parentCommentContainer);
            });
          });

        document.querySelector(".view-thread-title").innerText = title;
        document.querySelector(".view-thread-creator").innerText = creatorId;

        document.querySelector(".view-thread-content").innerText = content;

        document.querySelector(".view-thread-id").innerText = id;

        goToSubpage("view-thread");
      })
  );
};

/*
    Main program
*/
let token = JSON.parse(localStorage.getItem("token"))?.token;

if (currentThread && token) {
  viewThread(currentThread, getUserId());
  displayThreads(0);
} else {
  goToPage(token ? "dashboard" : "login");
}

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
      displayThreads(page);
    })
    .catch((err) => displayError(err));
});

document.querySelector("#edit-thread-btn").addEventListener("click", () => {
  const title = document.querySelector(".view-thread-title").innerText;
  const content = document.querySelector(".view-thread-content").innerText;
  const threadId = document.querySelector(".view-thread-id").innerText;

  request(`thread?id=${threadId}`, "GET", "", token).then(
    ({ isPublic, lock }) => {
      document.querySelector("#edit-thread-title").value = title;
      document.querySelector("#edit-thread-content").value = content;
      document.querySelector("#edit-thread-private").checked = !isPublic;
      document.querySelector("#edit-thread-locked").checked = lock;

      goToSubpage("edit-thread");
    }
  );
});
document
  .querySelector("#edit-submit-thread-btn")
  .addEventListener("click", (e) => {
    e.preventDefault();
    const title = document.querySelector("#edit-thread-title").value;
    const content = document.querySelector("#edit-thread-content").value;
    const isPublic = !document.querySelector("#edit-thread-private").checked;
    const isLocked = document.querySelector("#edit-thread-locked").checked;

    const threadId = document.querySelector(".view-thread-id").innerText;

    request(
      "thread",
      "PUT",
      { id: threadId, title, isPublic, content, lock: isLocked },
      token
    ).then(() => {
      viewThread(threadId, getUserId());
      displayThreads(0);
    });
  });

document.querySelector("#delete-thread-btn").addEventListener("click", () => {
  const threadId = document.querySelector(".view-thread-id").innerText;
  request("thread", "DELETE", { id: threadId }, token).then(() =>
    displayThreads(0).then((data) => {
      const threadList = document.querySelector("#thread-list");
      const threadToView = threadList.querySelector(".card-id")?.innerText;
      if (!threadToView) {
        localStorage.removeItem("currentThread");
        return goToPage("dashboard");
      }
      viewThread(threadToView, getUserId());
    })
  );
});
document.querySelector("#like-thread-btn").addEventListener("click", (e) => {
  const threadId = document.querySelector(".view-thread-id").innerText;
  const turnon =
    document.querySelector(".thread-btn-container .bi-heart-fill").style
      .display === "none";

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
  const turnon =
    document.querySelector("#watch-thread-btn").innerText === "Watch";
  const threadId = document.querySelector(".view-thread-id").innerText;
  request("thread/watch", "PUT", { id: threadId, turnon }, token).then(() =>
    viewThread(threadId, getUserId())
  );
});

const container = document.querySelector("#thread-list");

document
  .querySelector("#load-more-threads-btn")
  .addEventListener("click", (e) => {
    page = page + 5;
    displayThreads(page, true).then(({ success, num }) => {
      if (!success || num <= 4) e.target.style.display = "none";
    });
  });

document.querySelector("#comment-btn").addEventListener("click", () => {
  const commentText = document.querySelector("#comment-text-area").value;
  const threadId = document.querySelector(".view-thread-id").innerText;
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
    viewThread(threadId, getUserId());
  });
});

document
  .querySelectorAll("#login-link, #register-link, #dashboard-link")
  .forEach((link) =>
    link.addEventListener("click", () => goToPage(`${link.id.split("-")[0]}`))
  );

document.querySelector("#user-btn").addEventListener("click", (e) => {
  e.preventDefault();
  const newName = document.querySelector("#user-name").value;
  const newEmail = document.querySelector("#user-email").value;
  const newPassword = document.querySelector("#user-password").value;
  const newImage = document.querySelector("#user-img")?.files[0];

  if (newImage) {
    fileToDataUrl(document.querySelector("#user-img").files[0]).then(
      (encoding) =>
        request(
          `user?userId=${getUserId()}`,
          "PUT",
          {
            email: newEmail,
            password: newPassword,
            name: newName,
            image: encoding,
          },
          token
        ).then(() => goToPage("dashboard"))
    );
  } else {
    request(
      `user`,
      "PUT",
      {
        email: newEmail,
        password: newPassword,
        name: newName,
        userId: getUserId(),
      },
      token
    ).then(() => goToPage("dashboard"));
  }
});
document.querySelector(".profile-btn").addEventListener("click", (e) => {
  e.preventDefault();
  handleUserNameClick(getUserId());
});
