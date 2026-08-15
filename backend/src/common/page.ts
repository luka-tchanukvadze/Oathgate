// One more row than asked for is fetched, and its presence is what sets
// hasMore. Cheaper than a COUNT over the whole table on every page load
export interface Page<T> {
  data: T[];
  hasMore: boolean;
}
