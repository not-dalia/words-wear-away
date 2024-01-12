const resourceSelectorDialog = document.querySelector('dialog')
const cancelButton = document.querySelector('#cancel-button')
const readButton = document.querySelector('#read-button')
const bookSelector = document.querySelector('#book-selector')
const dialogError = document.querySelector('#dialog-error')
const bookContent = document.querySelector('#book-content')
const main = document.querySelector('main')

const populateOptions = () => {
  const resourceSelector = document.querySelector('#resource-selector')
  // clear options
  resourceSelector.innerHTML = ''
  // insert empty selected option
  const emptyOption = document.createElement('option')
  emptyOption.setAttribute('value', '')
  emptyOption.setAttribute('disabled', '')
  emptyOption.setAttribute('selected', '')
  resourceSelector.append(emptyOption)
  Object.keys(ResourceRegister).forEach(k => {
    const option = document.createElement('option')
    option.setAttribute('value', k)
    option.innerHTML = k
    resourceSelector.append(option)
  })
}

const setDialogError = (message) => {
  dialogError.innerHTML = message
  dialogError.style.display = 'block'
}

const clearDialogError = () => {
  dialogError.style.display = 'none'
  dialogError.innerHTML = ''
}

const clearBookSelector = () => {
  bookSelector.value = ''
}

const showResourceSelector = () => {
  populateOptions()
  clearDialogError()
  clearBookSelector()
  resourceSelectorDialog.showModal()
}

const hideResourceSelector = () => {
  resourceSelectorDialog.close()
}

const scrollToTop = () => {
  main.scrollTop = 0
}

// when clicking left or right arrow keys, go to previous or next page
// unless the user is typing in the book selector
// or a dialog is open
// or the user is focused on a text/number/checkbox/radio/select input
document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName == 'INPUT' || document.activeElement.tagName == 'SELECT') return
  if (e.target.id == 'book-selector' || resourceSelectorDialog.open) return
  if (e.key == 'ArrowLeft') {
    document.querySelector('#previous-page').click()
  } else if (e.key == 'ArrowRight') {
    document.querySelector('#next-page').click()
  }
})

cancelButton.addEventListener('click', hideResourceSelector)
