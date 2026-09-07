import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Facebook,
  Music2,
  CheckCircle2,
  UserCheck,
  Search,
  RotateCcw,
  X,
  ChevronDown,
} from "lucide-react";
import { useSocialFriends, type SocialFriend } from "@/lib/social-friends";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  regionLabel,
  REGION_OPTIONS,
  useSocialAccounts,
  type SocialAccount,
} from "@/data/social-accounts";
import { ListPagination } from "@/components/ListPagination";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/outreach/social/accounts")({
  head: () => ({
    meta: [
      { title: "社媒账号 · 出海大数据平台" },
      { name: "description", content: "查看与管理已购买的 Facebook / TikTok 触达账号。" },
      { property: "og:title", content: "社媒账号" },
      { property: "og:description", content: "统一管理你的社媒触达账号。" },
    ],
  }),
  component: SocialAccountsPage,
});

type PlatformFilter = "all" | "Facebook" | "TikTok";
type SocialStatus = "正常" | "风控" | "被封";
const STATUS_OPTIONS: SocialStatus[] = ["正常", "风控", "被封"];

/** 按到期时间返回分档（用于行底色与标签） */
type ExpiryBucket = "safe" | "quarter" | "month" | "week" | "expired" | "none";
function getExpiryBucket(expiresAt?: string): ExpiryBucket {
  if (!expiresAt) return "none";
  const now = new Date();
  const exp = new Date(expiresAt);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days < 7) return "week";
  if (days < 30) return "month";
  if (days <= 90) return "quarter";
  return "safe";
}
const EXPIRY_ROW_TONE: Record<ExpiryBucket, string> = {
  safe: "",
  quarter: "bg-amber-50/40",
  month: "bg-orange-50/60",
  week: "bg-rose-50/70",
  expired: "bg-rose-100/70",
  none: "",
};
const EXPIRY_TEXT_TONE: Record<ExpiryBucket, string> = {
  safe: "text-muted-foreground",
  quarter: "text-amber-700",
  month: "text-orange-700 font-medium",
  week: "text-rose-700 font-semibold",
  expired: "text-rose-700 font-semibold",
  none: "text-muted-foreground",
};
const EXPIRY_LABEL: Record<ExpiryBucket, string> = {
  safe: "充足",
  quarter: "1-3 个月",
  month: "剩余 <1 个月",
  week: "剩余 <1 周",
  expired: "已过期",
  none: "",
};

const STATUS_TONE: Record<SocialStatus, string> = {
  正常: "bg-emerald-50 text-emerald-700 border-emerald-200",
  风控: "bg-amber-50 text-amber-700 border-amber-200",
  被封: "bg-rose-50 text-rose-700 border-rose-200",
};

function StatusBadge({ status }: { status: SocialStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs", STATUS_TONE[status])}>
      {status === "正常" && <CheckCircle2 className="h-3 w-3" />}
      {status}
    </span>
  );
}

function SocialAccountsPage() {
  const accounts = useSocialAccounts();

  const friends = useSocialFriends();
  const friendCountByAccount = useMemo(() => {
    const m = new Map<string, number>();
    friends.forEach((f) => m.set(f.accountId, (m.get(f.accountId) ?? 0) + 1));
    return m;
  }, [friends]);

  const [friendsAccount, setFriendsAccount] = useState<SocialAccount | null>(null);
  const [allFriendsOpen, setAllFriendsOpen] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [region, setRegion] = useState<string>("all");
  const [statuses, setStatuses] = useState<SocialStatus[]>(["正常"]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return accounts.filter((a) => {
      if (platform !== "all" && a.platform !== platform) return false;
      if (region !== "all" && a.ownerRegion !== region) return false;
      if (!statuses.includes(a.status as SocialStatus)) return false;
      if (kw) {
        const hay = `${a.handle ?? ""} ${a.displayName ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [accounts, keyword, platform, region, statuses]);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  useEffect(() => {
    setPage(1);
  }, [keyword, platform, region, statuses]);
  const pageItems = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const hasFilter = keyword !== "" || platform !== "all" || region !== "all" || statuses.length !== 1 || statuses[0] !== "正常";
  const reset = () => {
    setKeyword("");
    setPlatform("all");
    setRegion("all");
    setStatuses(["正常"]);
  };

  const regionOptionsInUse = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach((a) => a.ownerRegion && set.add(a.ownerRegion));
    return REGION_OPTIONS.filter((r) => set.has(r.code));
  }, [accounts]);

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">社媒账号</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              统一查看已购买的社媒触达账号，支持按平台、状态、所属地区、关键字筛选。
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <Button
              variant="outline"

              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setAllFriendsOpen(true)}
            >
              <UserCheck className="h-3.5 w-3.5" />
              查看全部好友
              <span className="tabular-nums text-muted-foreground">({friends.length})</span>
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索账号 / 显示名"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformFilter)}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="平台" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">全部平台</SelectItem>
              <SelectItem value="Facebook" className="text-xs">Facebook</SelectItem>
              <SelectItem value="TikTok" className="text-xs">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="所属地区" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all" className="text-xs">全部地区</SelectItem>
              {regionOptionsInUse.map((r) => (
                <SelectItem key={r.code} value={r.code} className="text-xs">{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-2.5">
                状态
                <span className="text-muted-foreground">
                  {statuses.length === STATUS_OPTIONS.length
                    ? "全部"
                    : statuses.length === 1
                      ? statuses[0]
                      : `已选 ${statuses.length}`}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2.5" align="start">
              <div className="space-y-2">
                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-xs hover:bg-muted"
                  >
                    <Checkbox
                      checked={statuses.includes(s)}
                      onCheckedChange={(checked) => {
                        setStatuses((prev) =>
                          checked ? [...prev, s] : prev.filter((x) => x !== s),
                        );
                      }}
                    />
                    <StatusBadge status={s} />
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {hasFilter && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={reset}>
              <RotateCcw className="h-3 w-3" /> 重置
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">

            <span>
              共 <b className="text-foreground tabular-nums">{filtered.length}</b>
              {filtered.length !== accounts.length && (
                <span className="text-muted-foreground"> / {accounts.length}</span>
              )}
              {" "}个
            </span>
          </div>
        </div>
        {accounts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">尚无社媒账号。</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            没有匹配的账号，请调整筛选条件。
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>平台</TableHead>
                <TableHead>账号</TableHead>
                <TableHead>显示名</TableHead>
                <TableHead className="w-[110px]">状态</TableHead>
                <TableHead className="w-[110px]">所属地区</TableHead>
                <TableHead className="w-[100px]">好友数量</TableHead>
                <TableHead className="w-[130px]">交付时间</TableHead>
                <TableHead className="w-[130px]">到期时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  friendCount={friendCountByAccount.get(a.id) ?? 0}
                  onFriendsClick={() => setFriendsAccount(a)}
                />
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > 0 && (
          <div className="px-4 pb-4">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {friendsAccount && (
        <FriendsDialog
          account={friendsAccount}
          friends={friends.filter((f) => f.accountId === friendsAccount.id)}
          onClose={() => setFriendsAccount(null)}
        />
      )}

      {allFriendsOpen && (
        <AllFriendsDialog
          friends={friends}
          onClose={() => setAllFriendsOpen(false)}
        />
      )}
    </div>
  );
}

function AccountRow({ account, friendCount, onFriendsClick }: { account: SocialAccount; friendCount: number; onFriendsClick?: () => void }) {
  const bucket = getExpiryBucket(account.expiresAt);
  return (
    <TableRow className={cn(EXPIRY_ROW_TONE[bucket])}>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          {account.platform === "Facebook" ? (
            <Facebook className="h-3.5 w-3.5 text-sky-600" />
          ) : account.platform === "TikTok" ? (
            <Music2 className="h-3.5 w-3.5 text-rose-600" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          {account.platform}
        </span>
      </TableCell>
      <TableCell className="font-mono text-xs">{account.handle}</TableCell>
      <TableCell className="text-sm">{account.displayName}</TableCell>
      <TableCell>
        <StatusBadge status={(account.status as SocialStatus) ?? "正常"} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{regionLabel(account.ownerRegion)}</TableCell>
      <TableCell className="text-xs tabular-nums">
        {friendCount > 0 ? (
          <button
            type="button"
            onClick={onFriendsClick}
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="查看该账号名下的所有好友"
          >
            <UserCheck className="h-3 w-3" />
            {friendCount}
          </button>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {account.deliveredAt ? new Date(account.deliveredAt).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="text-xs">
        {account.expiresAt ? (
          <span className={cn("inline-flex flex-col leading-tight", EXPIRY_TEXT_TONE[bucket])}>
            <span className="tabular-nums">{new Date(account.expiresAt).toLocaleDateString()}</span>
            {bucket !== "safe" && bucket !== "none" && (
              <span className="text-[11px]">{EXPIRY_LABEL[bucket]}</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function FriendsDialog({
  account,
  friends,
  onClose,
}: {
  account: SocialAccount;
  friends: SocialFriend[];
  onClose: () => void;
}) {
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    if (!k) return friends;
    return friends.filter(
      (f) =>
        (f.socialId ?? "").toLowerCase().includes(k) ||
        (f.handle ?? "").toLowerCase().includes(k) ||
        (f.name ?? "").toLowerCase().includes(k),
    );

  }, [friends, kw]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            好友列表
            <Badge variant="secondary" className="ml-1 font-normal">
              {account.platform} · {account.handle}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            账号 {account.handle} 的好友数据
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={kw}
            onChange={(e) => {
              setKw(e.target.value);
              setPage(1);
            }}
            placeholder="按账号 / 显示名搜索"
            className="h-8 pl-8 text-xs"
          />
          {kw && (
            <button
              type="button"
              onClick={() => setKw("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {kw ? "没有匹配的好友" : "该账号暂无好友"}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">平台</TableHead>
                  <TableHead>账号ID</TableHead>
                  <TableHead>显示名</TableHead>
                </TableRow>

              </TableHeader>
              <TableBody>
                {pageData.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {f.platform === "Facebook" ? (
                          <Facebook className="h-3.5 w-3.5 text-sky-600" />
                        ) : f.platform === "TikTok" ? (
                          <Music2 className="h-3.5 w-3.5 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {f.platform}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.socialId || f.handle || "—"}</TableCell>

                    <TableCell className="text-sm">{f.name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="pb-1 pt-3">
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AllFriendsDialog({
  friends,
  onClose,
}: {
  friends: SocialFriend[];
  onClose: () => void;
}) {
  const [kw, setKw] = useState("");
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return friends.filter((f) => {
      if (platform !== "all" && f.platform !== platform) return false;
      if (!k) return true;
      const hay = `${f.socialId ?? ""} ${f.handle ?? ""} ${f.name ?? ""}`.toLowerCase();
      return hay.includes(k);

    });
  }, [friends, kw, platform]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            全部好友
            <Badge variant="secondary" className="ml-1 font-normal tabular-nums">
              {friends.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">全部社媒账号名下的好友数据</DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kw}
              onChange={(e) => {
                setKw(e.target.value);
                setPage(1);
              }}
              placeholder="按账号 / 显示名搜索"
              className="h-8 pl-8 text-xs"
            />
            {kw && (
              <button
                type="button"
                onClick={() => setKw("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select
            value={platform}
            onValueChange={(v) => {
              setPlatform(v as PlatformFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="平台" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">全部平台</SelectItem>
              <SelectItem value="Facebook" className="text-xs">Facebook</SelectItem>
              <SelectItem value="TikTok" className="text-xs">TikTok</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {kw || platform !== "all" ? "没有匹配的好友" : "暂无好友数据"}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">平台</TableHead>
                  <TableHead>账号ID</TableHead>
                  <TableHead>显示名</TableHead>
                </TableRow>

              </TableHeader>
              <TableBody>
                {pageData.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {f.platform === "Facebook" ? (
                          <Facebook className="h-3.5 w-3.5 text-sky-600" />
                        ) : f.platform === "TikTok" ? (
                          <Music2 className="h-3.5 w-3.5 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        {f.platform}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{f.socialId || f.handle || "—"}</TableCell>
                    <TableCell className="text-sm">{f.name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="pb-1 pt-3">
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
