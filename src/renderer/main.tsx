import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import BookFeature from "./BookFeature";
import BookList from "./BookList";
import "./styles/global.css";


createRoot(document.getElementById('book-root')!).render(
    <Provider store={store}>
        <BookFeature />
        <BookList />
    </Provider>
)