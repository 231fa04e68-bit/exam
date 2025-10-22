const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'books.json');

async function readBooks() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading books.json:', err.message);
    throw err;
  }
}

async function writeBooks(books) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(books, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing books.json:', err.message);
    throw err;
  }
}

function parseId(idStr) {
  const id = Number.parseInt(idStr, 10);
  return Number.isNaN(id) ? null : id;
}

// Root: redirect to /books so opening base URL shows content
app.get('/', (req, res) => {
  return res.redirect('/books');
});

// GET /books -> return all books
app.get('/books', async (req, res) => {
  try {
    const books = await readBooks();
    return res.json(books);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read books.' });
  }
});

// Bonus: GET /books/available -> only available books
app.get('/books/available', async (req, res) => {
  try {
    const books = await readBooks();
    return res.json(books.filter(b => b && b.available === true));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read books.' });
  }
});

// POST /books -> add a new book with auto-increment id
app.post('/books', async (req, res) => {
  try {
    const { title, author, available } = req.body || {};

    if (!title || !author) {
      return res.status(400).json({ error: 'title and author are required' });
    }

    const books = await readBooks();
    const maxId = books.reduce((max, b) => (typeof b.id === 'number' && b.id > max ? b.id : max), 0);
    const newBook = {
      id: maxId + 1,
      title: String(title),
      author: String(author),
      available: typeof available === 'boolean' ? available : false,
    };

    books.push(newBook);
    await writeBooks(books);

    return res.status(201).json(newBook);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add book.' });
  }
});

// PUT /books/:id -> update fields of a book
app.put('/books/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const updates = req.body || {};
    const allowed = ['title', 'author', 'available'];
    const hasAllowed = Object.keys(updates).some(k => allowed.includes(k));
    if (!hasAllowed) {
      return res.status(400).json({ error: 'At least one of title, author, available must be provided' });
    }

    const books = await readBooks();
    const idx = books.findIndex(b => b && b.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const book = books[idx];
    if (typeof updates.title !== 'undefined') book.title = String(updates.title);
    if (typeof updates.author !== 'undefined') book.author = String(updates.author);
    if (typeof updates.available !== 'undefined') book.available = Boolean(updates.available);

    books[idx] = book;
    await writeBooks(books);

    return res.json(book);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update book.' });
  }
});

// DELETE /books/:id -> delete a book by id
app.delete('/books/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const books = await readBooks();
    const idx = books.findIndex(b => b && b.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Book not found' });
    }

    books.splice(idx, 1);
    await writeBooks(books);

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete book.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Books API running on http://localhost:${PORT}`);
});
