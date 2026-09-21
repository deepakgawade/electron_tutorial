import { useGetAllBooksQuery } from './potterApi'
import { useAppDispatch, useAppSelector } from './hooks'
import { toggleFavorite } from './favoritesSlice'

const BookList = () => {
    const { data: books, isLoading, isError } = useGetAllBooksQuery()

    const dispatch = useAppDispatch()
    const favoriteIndexes = useAppSelector((state) => state.favorites.indexes)

    if (isLoading) return <p>Loading books...</p>
    if (isError) return <p className="error-text">Failed to load books.</p>

    return (
        <div>
            <p>Favorites: {favoriteIndexes.length}</p>
            <ul className="book-list">
                {books?.map((book) => (
                    <li key={book.index}>
                        <button className="favorite-btn" onClick={() => dispatch(toggleFavorite(book.index))}>
                            {favoriteIndexes.includes(book.index) ? '★' : '☆'}
                        </button>
                        <img src={book.cover} alt={book.title} width="40" />
                        {book.title} — {book.releaseDate}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default BookList
