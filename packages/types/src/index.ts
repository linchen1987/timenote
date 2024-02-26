export type RuleType = 'keywords' | 'createdRange' | 'updatedRange';
export type MatchType = 'all' | 'any';
export type MenuItemType = 'list' | 'post';

type Rule = {
  type: RuleType;
};

type KeywordsRule = Rule & {
  type: 'keywords';
  matchType?: 'all' | 'any';
  keywords?: string[];
};

type DateRangeRule = Rule & {
  durationDays: number;
  start: Date;
  end: Date;
  // referenceDate: 'CURRENT_DATE';
};

type CreateRangeRule = DateRangeRule & {
  type: 'created';
};

type UpdatedRangeRule = DateRangeRule & {
  type: 'updated';
};

export type MenuItemMatchRule = KeywordsRule | CreateRangeRule | UpdatedRangeRule;

export type MenuItemConfig = {
  postId?: string;
  matchType?: MatchType;
  matchRules?: MenuItemMatchRule[];
};
