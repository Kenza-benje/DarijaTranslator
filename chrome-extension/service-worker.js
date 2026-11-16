const MENU_ID = "translate-to-darija";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Translate to Darija",
    contexts: ["selection"]
  });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => console.error("Could not enable the toolbar side panel."));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText || !tab) return;

  // Open immediately within the user gesture; storage handles either loading order.
  chrome.sidePanel.open({ windowId: tab.windowId })
    .catch(() => console.error("Could not open the side panel. Use the toolbar icon."));
  chrome.storage.session.set({
    [`selection-${tab.windowId}`]: { id: crypto.randomUUID(), text: info.selectionText }
  }).catch(() => console.error("Could not transfer the selected text."));
});

chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.session.remove(`selection-${windowId}`)
    .catch(() => console.error("Could not clear the closed window's selection."));
});
