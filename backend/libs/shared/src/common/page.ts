// One row more than asked for is fetched, and its presence sets hasMore
// Cheaper than a COUNT over the whole table on every page load
export interface Page<T> {
  data: T[];
  hasMore: boolean;
}
