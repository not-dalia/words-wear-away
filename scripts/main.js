class BookUtils {
  static WORD_SEPARATOR_REGEX = /[^a-zA-Z0-9'-]/;
  static WORD_REGEX = /[a-zA-Z0-9'-]+/g;
  static HEADERS = ['HEADER', 'HGROUP', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  static CHAPTER_TITLE_REGEX = /%%%ID:(.*?);TITLE:(.*?)%%%/g;
  static WORDS_PER_PAGE = 200;
}

class HTMLBookFetcher {
  async fetchBookFromURL (url) {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const htmlBook = parser.parseFromString(html, 'text/html');
    return htmlBook;
  }
}

class BookParser {
  parseHTMLBook (htmlBook) {
    const { title, author } = this.getBookTitleAndAuthor(htmlBook);
    const bodyMatter = this.getBodyMatter(htmlBook);
    const bodyMatterText = this.getBodyMatterText(bodyMatter);
    const wordDictionary = this.createWordPositionsDictionary(bodyMatterText);
    const chapters = this.getChapters(bodyMatter);
    // const chapters = this.getChapters(bodyMatter);
    return { title, author, wordDictionary, text: bodyMatterText, htmlBody: this._getHTMLFromBodyMatter(bodyMatter), chapters };
  }

  _getHTMLFromBodyMatter (bodyMatter) {
    return Array.prototype.reduce.call(bodyMatter, function(html, node) {
      return html + ( node.outerHTML || node.nodeValue );
    }, "");
  }

  _getBookTitlePage (htmlBook) {
    return htmlBook.querySelector('#titlepage');
  }

  getChapters (bodyMatter) {
    let wordIndex = 0;
    const chapters = Array.from(bodyMatter).map(node => {
      // chapter title we assume is the first header in the section
      const Headers = BookUtils.HEADERS;
      const chapterTitle = Array.from(node.querySelectorAll('H2, H3, H4, H5, H6')).find(child => Headers.includes(child.nodeName))?.textContent || node.id;
      // for pages, we start adding node by node until the text length is greater or equal to BookUtils.WORDS_PER_PAGE
      // then we stop and add the page to the chapter
      const chapterText = this._getTextFromNode(node) || '';
      const pages = [];
      let currentPage = [];
      let currentPageWordCount = 0;
    /*   [...node.childNodes].forEach((child, cix) => {
        const text = this._getTextFromNode(child) || '';
        // split the text into words by spaces or new lines or tabs
        const characters = text.split('');
        let word = '';
        // test character against BookUtils.WORD_SEPARATOR_REGEX
        // if it matches, then we add the word to the page
        characters.forEach((c, index) => {
          if (c.match(BookUtils.WORD_SEPARATOR_REGEX)) {
            if (word.length > 0) {
              let span = `<span data-word-index="${wordIndex}" data-word="${word}">${word}</span>`;
              wordIndex++;
              currentPage.push(span);
              currentPageWordCount++;
              word = '';
            }
            currentPage.push(c);
          } else {
            word += c;
          }
        });
        if (currentPageWordCount >= BookUtils.WORDS_PER_PAGE || cix === node.childNodes.length - 1) {
          // we have enough words, so we add the page to the chapter
          let trimmedPage = currentPage.join('').trim();
          if (trimmedPage.length > 0) pages.push(trimmedPage);
          // pages.push(currentPage.join(''));
          currentPage = [];
          currentPageWordCount = 0;
        }
      }); */
      let word = '';
      for (let index = 0; index < chapterText.length; index++) {
        const c = chapterText[index];
        if (c.match(BookUtils.WORD_SEPARATOR_REGEX)) {
          if (word.length > 0) {
            let span = `<span data-word-index="${wordIndex}" data-word="${word}">${word}</span>`;
            wordIndex++;
            currentPage.push(span);
            currentPageWordCount++;
            word = '';
          }
          currentPage.push(c);
        } else {
          word += c;
        }
        if (currentPageWordCount >= BookUtils.WORDS_PER_PAGE || index === chapterText.length - 1) {
          // we have enough words, so we add the page to the chapter
          pages.push(currentPage.join(''));
          currentPage = [];
          currentPageWordCount = 0;
        }
      }

      return {
        chapterId: node.id,
        chapterTitle,
        pages
      }
    })
    return chapters;
  }

  getBookTitleAndAuthor (htmlBook) {
    const titlePage = this._getBookTitlePage(htmlBook);
    const title = titlePage?.querySelector('h1')?.textContent;

    // *| is a namespace selector, it means "any namespace"
    // see https://www.w3.org/TR/selectors-3/#attrnmsp
    // ~= means find exact value in a space-separated list of values
    // see https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors
    const author = titlePage?.querySelector('[epub\\:type~="z3998:author"]')?.textContent;
    return { title, author };
  }

  getBodyMatter (htmlBook) {
    return htmlBook.querySelectorAll('[epub\\:type~="bodymatter"]');
  }

  _getTextFromNode (node) {
    // go the node until reaching a text node
    // ignore any nodes that are hgroup, h1, h2, h3, h4, h5, h6
    // only return text from text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    } else {
      if (!BookUtils.HEADERS.includes(node.nodeName)) {
        const children = [...node.childNodes];
        return children.map(child => this._getTextFromNode(child)).join('');
      }
    }
  }

  getBodyMatterText (bodyMatter) {
    let bodyMatterText = '';
    bodyMatter.forEach(node => {
      bodyMatterText += this._getTextFromNode(node);
    });
    return bodyMatterText;
  }

  createWordPositionsDictionary (text) {
    const words = text.split(BookUtils.WORD_SEPARATOR_REGEX);
    const wordDictionary = {};
    words.filter(w => w.length > 0).forEach((w, index) => {
      const word = w.toLowerCase();
      if (word.length > 0) {
        if (!wordDictionary[word]) wordDictionary[word] = { count: 0, positions: [] };
        wordDictionary[word].count += 1;
        wordDictionary[word].positions.push(index);
      }
    });
    return wordDictionary;
  }
}

class Book {
  constructor (title, author, text, htmlBody, wordDictionary, chapters) {
    this.title = title;
    this.author = author;
    this.text = text;
    this.htmlBody = htmlBody;
    this.wordDictionary = wordDictionary;
    this.chapters = chapters;
    this.pages = this._getPagesFromChapters();
  }

  _getPagesFromChapters () {
    const pages = [];
    let pageCounter = 0;
    this.chapters.forEach((chapter, cix) => {
      chapter.pages.forEach((page, pix) => {
        pages.push({
          chapterIndex: cix,
          pageIndex: pix,
          pageNumber: pageCounter,
        });
        pageCounter++;
      });
    });
    return pages;
  }

  static async fromURL (url) {
    const htmlBookFetcher = new HTMLBookFetcher();
    const bookParser = new BookParser();
    const htmlBook = await htmlBookFetcher.fetchBookFromURL(url);
    const { title, author, text, htmlBody, wordDictionary, chapters } = bookParser.parseHTMLBook(htmlBook);
    return new Book(title, author, text, htmlBody, wordDictionary, chapters);
  }

  static async fromJSONFile (fileUrl) {
    const response = await fetch(fileUrl);
    const json = await response.json();
    return new Book(json.title, json.author, json.text, json.htmlBody, json.wordDictionary, json.chapters);
  }

  get wordCount () {
    return this.text.split(/[^a-zA-Z0-9'-]/).length;
  }

  get uniqueWordCount () {
    return Object.values(this.wordDictionary).reduce((a, b) => a + b, 0).length;
  }

  get pageCount () {
    return Math.ceil(this.wordCount / this.wordsPerPage);
  }

  getPageWordBounds (pageNumber) {
    const start = pageNumber * this.wordsPerPage;
    const end = start + this.wordsPerPage;
    return { start, end };
  }

  download () {
    const book = {
      title: this.title,
      author: this.author,
      text: this.text,
      htmlBody: this.htmlBody,
      wordDictionary: this.wordDictionary,
      chapters: this.chapters,
    };

    const blob = new Blob([JSON.stringify(book)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title}.json`;
    a.click();
  }
}


