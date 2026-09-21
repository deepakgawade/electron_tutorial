import { useLazyGetRandomBookQuery }  from "./potterApi";

const BookFeature = () =>{
    const [fetchRandomBook, {data:book, isLoading, isError}] = useLazyGetRandomBookQuery()


    return <div>
        <button onClick={()=>fetchRandomBook()}>Random Book</button>
        {isLoading && <p>Loading...</p>}
        {isError && <p className="error-text">Failed to fetch a book. Try again.</p>}
        {book && (<div className="card">
            <h2>{book.title}</h2>
            <img src={book.cover} alt={book.title} width="150"/>
            <p>Pages: {book.pages} | Released: {book.releaseDate}</p>
            <p>{book.description}</p>
        </div>)}
        </div>
}

export default BookFeature
