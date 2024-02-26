const information = document.getElementById('info');
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;

/////

const func = async () => {
  const response = await window.versions.ping();
  console.log(response); // prints out 'pong'
};

func();

/////

const setButton = document.getElementById('btnSetTitle');
const titleInput = document.getElementById('title');
setButton.addEventListener('click', () => {
  const title = titleInput.value;
  window.electronAPI.setTitle(title);
});

/////

const openDialogBtn = document.getElementById('btnOpenDialog');
const filePathElement = document.getElementById('filePath');

openDialogBtn.addEventListener('click', async () => {
  const filePath = await window.electronAPI.openFile();
  filePathElement.innerText = filePath;
});

/////

const counter = document.getElementById('counter');

window.electronAPI.handleCounter((event, value) => {
  const oldValue = Number(counter.innerText);
  const newValue = oldValue + value;
  counter.innerText = newValue;
  // event.sender.send('counter-value', newValue)
});
