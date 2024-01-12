document.addEventListener('alpine:init', async () => {
  Alpine.data('book', () => ({
    settings: {
      minFade: 10,
      minFontSize: 90,
      maxFontSize: 180,
      wearScaling: 'custom',
      wearScalingCustomValue: 10,
      wearingStyle: ['shrink', 'fade'],
    },
    book: {
      title: 'Loading...',
      author: 'Loading...',
      chapters: [],
      pages: [],
    },
    progress: {
      wordCount: 0,
      uniqueWordCount: 0,
      selectedPageIndex: 0,
    },
    sidebarOpen: false,
    sidebarTransitionDone: false,
    toggleSidebar () {
      if (this.sidebarOpen) {
        this.sidebarOpen = false
        this.sidebarTransitionDone = false
      } else {
        this.sidebarOpen = true
        setTimeout(() => {
          this.sidebarTransitionDone = true
        }, 400)
      }
    },
    selectPreviousPage () {
      if (this.progress.selectedPageIndex > 0) {
        this.progress.selectedPageIndex--
        scrollToTop()
      }
    },
    selectNextPage () {
      if (this.progress.selectedPageIndex < this.book.pages.length - 1) {
        this.progress.selectedPageIndex++
        scrollToTop()
      }
    },

    setPageHTML (page) {
      // convert to html
      const pageHTML = document.createElement('div')
      pageHTML.innerHTML = page
      let prevFontSize = 1
      let prevFade = 100
      let newPageHTML = Array.from(pageHTML.childNodes).map((node, i) => {
        // if node is not a span, put it in a span and give it last known font size and fade
        if (node.nodeName != 'SPAN') {
          let span = document.createElement('span')
          span.innerText = node.textContent.replace(/\n\s*\n/g, '\n\n').replace(/\n/g, '\n\n').replace(/(\n){3,}/g, '\n\n')
          span.style.fontSize = `${prevFontSize}rem`
          span.style.opacity = `${prevFade}%`
          return span
        }

        let span = node
        let wordPositionIndex = this.book.wordDictionary[span.dataset.word.toLowerCase()].positions.findIndex(p => p >= span.dataset.wordIndex)
        let wearFactor = 1
        if (this.settings.wearScaling == 'book') {
          // wear factor is a value from 0 to 1 where 0 is if the word never appeared before (wordPositionIndex = 0) and 1 when the word appears this.book.mostFrequentWordCount times (wordPositionIndex = this.book.mostFrequentWordCount)
          wearFactor = wordPositionIndex / this.book.mostFrequentWordCount
        }
        else if (this.settings.wearScaling == 'word') {
          // wear factor is a value from 0 to 1 where 0 is if the word never appeared before (wordPositionIndex = 0) and 1 when the word appears this.book.wordDictionary[span.dataset.word].count times (wordPositionIndex = this.book.wordDictionary[span.dataset.word].count)

          let wordCount = this.book.wordDictionary[span.dataset.word.toLowerCase()].count
          wearFactor = wordPositionIndex / wordCount
        } else if (this.settings.wearScaling == 'custom') {
          // wear factor is a value from 0 to 1 where 0 is if the word never appeared before (wordPositionIndex = 0) and 1 when the word appears this.settings.wearScalingCustomValue times (wordPositionIndex = this.settings.wearScalingCustomValue)
          wearFactor = wordPositionIndex / this.settings.wearScalingCustomValue
        }

        wearFactor = Math.min(1, Math.max(0, wearFactor))


        if (this.settings.wearingStyle.includes('shrink')) {
          // shrink the font size of the word based on the wear factor
          // min font size is this.settings.minFontSize% of 1em
          // max font size is this.settings.maxFontSize% of 1em
          let fontSize = this.settings.minFontSize / 100 + (this.settings.maxFontSize - this.settings.minFontSize) / 100 * (1 - wearFactor)
          span.style.fontSize = `${fontSize}rem`
          prevFontSize = fontSize
        }
        if (this.settings.wearingStyle.includes('fade')) {
          // fade the word based on the wear factor
          // min fade is this.settings.minFade%
          // max fade is 100%
          // fade is opacity
          let fade = this.settings.minFade / 100 + (100 - this.settings.minFade) / 100 * (1 - wearFactor)
          span.style.opacity = `${fade * 100}%`
          prevFade = fade * 100
        }
        span.setAttribute('title', `${wordPositionIndex + 1} of ${this.book.wordDictionary[span.dataset.word.toLowerCase()].count}`)
        return span
      })
      // convert back to string
      let pageHTMLText = newPageHTML.map(node => node.outerHTML).join('')
      // replace multiple newlines (with possible spaces between them) with single newline
      // replace <br /> that occur more than three times in a row with two <br />s
      this.progress.selectedChapterPage = pageHTMLText.trim().replace(/\n\s*\n/g, '\n\n').replace(/\n/g, '<br /><br />').replace(/(<br \/>){3,}/g, '<br /><br />')

    },
    async selectRandomBook () {
      const keys = Object.keys(ResourceRegister)
      const randomKey = keys[Math.floor(Math.random() * keys.length)]
      this.selectedResource = randomKey
      return await Book.fromJSONFile(ResourceRegister[randomKey])
    },

    async init () {
      // if window width is less than 800px, close sidebar
      if (window.innerWidth < 800) {
        this.sidebarOpen = false
        this.sidebarTransitionDone = true
      } else {
        this.sidebarOpen = true
        this.sidebarTransitionDone = true
      }

      let book, pageNumber;
      let savedBook = this.getSavedBook()
      if (savedBook) {
        book = await getResource(savedBook)
        let savedPageProgress = this.getSavedPageProgress() || {}
        pageNumber = savedPageProgress || 0;
      } else {
        book = await this.selectRandomBook()
        let savedPageProgress = this.getSavedPageProgress() || {}
        pageNumber = savedPageProgress || 0;
      }

      this.book = book
      this.book.mostFrequentWord = Object.keys(book.wordDictionary).reduce((a, b) => book.wordDictionary[a].count > book.wordDictionary[b].count ? a : b)
      this.book.mostFrequentWordCount = book.wordDictionary[this.book.mostFrequentWord].count

      // console.log(book)
      this.$watch('progress.selectedPageIndex', (value) => {
        // console.log(`selected page index changed to ${value}`)
        if (!this.book.pages[value]) return
        let selectChapterIndex = this.book.pages[value].chapterIndex
        let selectedChapter = this.book.chapters[selectChapterIndex]
        if (selectedChapter) {
          this.progress.selectedChapterIndex = selectChapterIndex
          this.progress.selectedChapter = selectedChapter
          this.progress.chapterTitle = selectedChapter.chapterTitle
        }
        let selectedPage = this.book.pages[value]
        if (selectedPage) {
          this.progress.selectedPage = selectedPage
          this.progress.pageNumber = selectedPage.pageNumber
          this.savePageProgressForLater(value)
        }
        let selectedChapterPage = selectedChapter.pages[selectedPage.pageIndex]
        if (selectedChapterPage) this.setPageHTML(selectedChapterPage)
      })

      this.$watch('progress.selectedChapterIndex', (value) => {
        // console.log(`selected chapter index changed to ${value}`)
        if (this.book.chapters[value] == undefined) return
        if (this.progress.selectedPage.chapterIndex == value) return
        let selectedPageIndex = this.book.pages.findIndex(p => p.chapterIndex == value)
        if (selectedPageIndex != undefined) {
          this.progress.selectedPageIndex = selectedPageIndex
        }
      })

      this.$watch('settings', (value) => {
        if (this.progress.selectedPage == undefined) return
        this.setPageHTML(this.progress.selectedChapter.pages[this.progress.selectedPage.pageIndex])
      })

      this.progress = {
        wordCount: 0,
        uniqueWordCount: 0,
        selectedPageIndex: parseInt(pageNumber) || 0,
      }
    },
    selectChapter (chapterIndex) {
      let page = this.book.pages.find(p => p.chapterIndex == chapterIndex)
      if (page) {
        this.progress.selectedPage = page
      }
    },
    switchBook () {
      showResourceSelector()
    },
    saveSelectedBookForLater (resource) {
      // save resource to local storage
      let lastBook = localStorage.getItem('lastBook')
      localStorage.setItem('lastBook', resource)
    },
    savePageProgressForLater (page) {
      // save page to local storage
      let savedPageProgress = localStorage.getItem('savedPageProgress')
      let savedBook = localStorage.getItem('lastBook')
      if (savedPageProgress) {
        let progress = JSON.parse(savedPageProgress)
        progress[this.selectedResource || savedBook] = page
        localStorage.setItem('savedPageProgress', JSON.stringify(progress))
      } else {
        localStorage.setItem('savedPageProgress', JSON.stringify({ [this.selectedResource || savedBook]: page }))
      }
    },
    getSavedPageProgress () {
      let savedPageProgress = localStorage.getItem('savedPageProgress')
      let savedBook = localStorage.getItem('lastBook')
      if (savedPageProgress) {
        return JSON.parse(savedPageProgress)[this.selectedResource || savedBook]
      } else {
        return null
      }
    },
    getSavedBook () {
      let lastBook = localStorage.getItem('lastBook')
      if (lastBook) {
        return lastBook
      } else {
        return null
      }
    },
    async confirmBookSelection () {
      clearDialogError()
      const resourceSelector = document.querySelector('#resource-selector')
      const selectedResource = bookSelector.value
      if (selectedResource) {
        const selectedBook = await getResource(selectedResource)
        if (selectedBook) {
          this.selectedResource = selectedBook.resource
          this.saveSelectedBookForLater(selectedBook.resource)
          hideResourceSelector()
          // console.log(selectedBook)
          this.book = selectedBook
          this.progress = {
            wordCount: 0,
            uniqueWordCount: 0,
            selectedPageIndex: this.getSavedPageProgress() || 0,
          }
        } else {
          setDialogError('Could not load book. Maybe try something else?')
        }
      } else {
        setDialogError('Please select a book.')
      }
    }
  }))
})
