importScripts("https://www.gstatic.com/firebasejs/9.1.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.1.3/firebase-messaging-compat.js");
firebase.initializeApp({
  // apiKey: "AIzaSyAfCAlrwP15JQaHDQIVAE7ja4VWzLeHbC8",
  // authDomain: "hr-clap-aa6ef.firebaseapp.com",
  // projectId: "hr-clap-aa6ef",
  // storageBucket: "hr-clap-aa6ef.appspot.com",
  // messagingSenderId: "608874872311",
  // appId: "1:608874872311:web:223c3c0b835904642102f2",
  // measurementId: "G-ZEME1N486Z"

  apiKey: "AIzaSyBFsNTXTvjU9rmcatgUPwKrvxR1l-CSU4s",
  authDomain: "isms-up.firebaseapp.com",
  projectId: "isms-up",
  storageBucket: "isms-up.appspot.com",
  messagingSenderId: "937149398504",
  appId: "1:937149398504:web:fdddac31b5280897fc785d",
  // vapidKey: "BMMw6hpDLUA1zI0d_2XLb3bS6hdQIClgMU6iXtfJGz-mSKBsl1ygLM3J8U2hY71mGISQUxXqWBxnYDBq268RR34"
});
const messaging = firebase.messaging();

console.log("window", self.location);

messaging.onBackgroundMessage((payload) => {
  console.log("onBackgroundMessage ", payload);
  // alert(1);
  // if (payload.data.type === 'candidate-response') {
  // console.log("payload.data.type", payload.data.type);
  // self.location.href = 'http://localhost:42009/i/inbox/5fa98883-69db-41c4-863b-89bbe1c5ab91'; //'/i/inbox/' + payload.data.candidateId;
  // self.location.href = "http://localhost:42009/i/dashboard?q=123";
  // }

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
    data: payload.data, // Pass the custom data object along with the notification
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  console.log("clicked");
  event.notification.close(); // Close the notification

  // Retrieve the notification's data property
  const urlToOpen = event.notification.data ? event.notification.data.url : "/";

  // Open the link in a new window or tab
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // If there is an existing tab, focus it
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If no existing tab, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
