import { useState } from "react";

export type Page = "auth" | "store" | "library";

/**
 * Custom hook to manage current page navigation.
 */
export const useNavigation = (initialPage: Page = "auth") => {
  const [currentPage, setCurrentPage] = useState<Page>(initialPage);

  const navigate = (page: Page) => {
    setCurrentPage(page);
  };

  return { currentPage, navigate };
};