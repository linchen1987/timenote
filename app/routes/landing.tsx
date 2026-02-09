import {
  ArrowRight,
  BookOpen,
  Cloud,
  Database,
  Download,
  Github,
  Globe,
  LayoutGrid,
  type LucideIcon,
  Mail,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  Zap,
} from 'lucide-react';
import { Link, type MetaFunction } from 'react-router';
import { toast } from 'sonner';
import { useTheme } from '~/components/theme-provider';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

export const meta: MetaFunction = () => {
  return [{ title: 'Time Note - 轻松记录你的想法' }];
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full w-10 h-10 text-muted-foreground hover:text-foreground"
        >
          <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute w-5 h-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[120px] backdrop-blur-xl">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Sun className="w-4 h-4 text-orange-500" /> <span>浅色模式</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Moon className="w-4 h-4 text-blue-500" /> <span>深色模式</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className="rounded-xl gap-2 cursor-pointer font-medium"
        >
          <Monitor className="w-4 h-4 text-primary" /> <span>系统设置</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function LandingPage() {
  const copyEmail = () => {
    const email = 'link.lin.1987@gmail.com';
    navigator.clipboard.writeText(email);
    toast.success('邮箱已复制到剪切板');
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 relative overflow-x-hidden font-sans">
      {/* Visual Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[120px] opacity-60 animate-pulse" />
        <div
          className="absolute bottom-[5%] right-[-5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px] opacity-40 animate-pulse"
          style={{ animationDelay: '3s' }}
        />
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 group transition-transform hover:scale-105 active:scale-95"
          >
            <div className="w-7 h-7">
              <img src="/logo.svg" alt="Time Note" className="w-full h-full drop-shadow-sm" />
            </div>
            <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-foreground/60 uppercase">
              Time Note
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-2 border-r border-border/40 pr-4 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full w-10 h-10 hover:text-foreground hover:bg-accent transition-colors"
              >
                <a
                  href="https://github.com/linchen1987/timenote"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="GitHub 仓库"
                >
                  <Github className="w-5 h-5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="rounded-full w-10 h-10 hover:text-foreground hover:bg-accent transition-colors"
              >
                <a
                  href="https://link1987.site"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="作者主页"
                >
                  <Globe className="w-5 h-5" />
                </a>
              </Button>
            </div>
            <ThemeToggle />
            <Link to="/s/list">
              <Button className="rounded-full px-6 h-10 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300">
                开始使用
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* HERO SECTION */}
        <section className="min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20">
          <div className="max-w-5xl mx-auto text-center space-y-12 animate-fade-in">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black tracking-widest uppercase">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>灵感不再转瞬即逝</span>
            </div>

            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black tracking-tighter leading-[0.9] text-balance">
              时间笔记 <br />
              <span className="opacity-40">随想随记</span>
            </h1>

            <p className="text-lg sm:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium text-balance opacity-80">
              极简、高效、私有的碎片化记录工具
              <br />
              让你的想法像呼吸一样自然地被捕获
            </p>

            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-6">
              <Link to="/s/list">
                <Button
                  size="lg"
                  className="h-16 rounded-2xl text-xl px-12 font-black gap-3 shadow-[0_20px_40px_-15px_rgba(var(--primary-rgb),0.3)] hover:scale-105 hover:shadow-[0_25px_50px_-12px_rgba(var(--primary-rgb),0.4)] transition-all duration-500"
                >
                  开启记录之旅 <ArrowRight className="w-6 h-6" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="h-16 rounded-2xl text-xl px-12 font-bold border-2 backdrop-blur-sm hover:bg-muted/50 transition-all duration-500"
                asChild
              >
                <a
                  href="https://github.com/linchen1987/timenote"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看源代码
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* 数据自主 SECTION */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              <div className="lg:col-span-5 space-y-8 order-2 lg:order-1">
                <div className="text-center lg:text-left space-y-4">
                  <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-none text-primary">
                    数据自主
                  </h2>
                  <p className="text-xl text-muted-foreground font-semibold leading-relaxed">
                    Bring Your Own Storage
                    <br />
                    你的数据，完全由你掌控。
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <Cloud className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">存储自由</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium text-balance">
                        支持 WebDAV 和 S3 协议。你可以将笔记存储在自己的网盘或任何兼容 S3
                        协议的云存储中，真正实现 Bring Your Own Storage。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">开源且独立</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium text-balance">
                        Time Note
                        是一个完全开源的项目。应用不依赖于任何中心化服务商，让你在自由使用的同时，无须担心服务商的变动或约束。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <Download className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">随时迁移</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium text-balance">
                        支持数据的导入与导出。你的数字资产应如空气般自由，你可以随时带走你的所有笔记，不留下一丝束缚。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="aspect-[16/10] bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-8 relative overflow-hidden group shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-50" />
                  <div className="relative h-full flex flex-col justify-center items-center gap-8">
                    <div className="flex items-center gap-6">
                      <div
                        className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary border border-primary/20 animate-bounce"
                        style={{ animationDuration: '3s' }}
                      >
                        <Cloud className="w-10 h-10" />
                      </div>
                      <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                      <div className="w-24 h-24 bg-primary/20 rounded-[2rem] flex items-center justify-center text-primary shadow-xl shadow-primary/10 border-2 border-primary/20 animate-pulse">
                        <Database className="w-12 h-12" />
                      </div>
                      <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                      <div
                        className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary border border-primary/20 animate-bounce"
                        style={{ animationDuration: '3s', animationDelay: '1.5s' }}
                      >
                        <Download className="w-10 h-10" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                        Bring Your Own Storage
                      </p>
                      <div className="flex gap-2 justify-center">
                        <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold text-primary uppercase tracking-tight">
                          WebDAV
                        </span>
                        <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold text-primary uppercase tracking-tight">
                          S3 Compatible
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 多笔记本 SECTION */}
        <section className="py-32 px-6 relative overflow-hidden bg-muted/20">
          <div className="max-w-7xl mx-auto">
            <div className="relative p-12 sm:p-24 bg-card border border-border/50 rounded-[4rem] overflow-hidden group shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.05]" />
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-black tracking-widest uppercase text-primary">
                    PWA Ready
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-5xl sm:text-7xl font-black tracking-tight leading-none text-balance">
                      多笔记本
                    </h2>
                    <p className="text-2xl font-bold text-muted-foreground leading-relaxed text-balance">
                      再小的笔记本，都是一个独立应用
                    </p>
                  </div>
                  <p className="text-xl font-medium text-muted-foreground/80 leading-relaxed">
                    你可以创建多个笔记本，每个笔记本都可以像一个独立 APP 一样单独打开。通过 PWA
                    技术，每一个笔记本都可以安装到手机桌面。
                  </p>
                </div>

                <div className="flex justify-center relative">
                  <div className="w-full max-w-[280px] aspect-[9/19] bg-background/50 backdrop-blur-2xl border-4 border-border/50 rounded-[3rem] p-4 relative shadow-2xl group-hover:-translate-y-4 transition-transform duration-700">
                    <div className="w-1/3 h-1.5 bg-muted rounded-full mx-auto mb-8" />
                    <div className="space-y-4 opacity-30">
                      <div className="h-24 bg-muted rounded-2xl" />
                      <div className="h-12 bg-muted rounded-xl" />
                      <div className="h-12 bg-muted rounded-xl" />
                      <div className="h-12 bg-muted rounded-xl" />
                    </div>
                    <div className="absolute -right-6 top-1/3 w-20 h-20 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-2xl rotate-12 group-hover:rotate-0 transition-all duration-500">
                      <Smartphone className="w-10 h-10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 轻松记录 SECTION */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4 text-center lg:text-left">
                  <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
                    轻松记录
                  </h2>
                  <p className="text-xl text-muted-foreground font-semibold leading-relaxed">
                    记录时只专注于记录
                    <br className="hidden sm:block" />
                    抛弃一切阻碍记录的烦恼
                  </p>
                </div>

                <div className="space-y-8">
                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <Zap className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">碎片化记录</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium">
                        不需要写标题，不需要配图，像发微信、发朋友圈、发 Twitter
                        一样，随时记录瞬间的灵感和想法。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 ease-spring">
                      <BookOpen className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold tracking-tight">深度思考</h3>
                      <p className="text-muted-foreground leading-relaxed font-medium">
                        也支持沉浸、专注的深度思考模式，记录长篇笔记，让你完整表达复杂的思想。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="aspect-[16/10] bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-8 relative overflow-hidden group shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-50" />
                  <div className="relative h-full flex flex-col gap-4">
                    <div className="flex gap-3 items-center mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500/20" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/20" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20" />
                    </div>
                    <div className="space-y-4">
                      <div className="h-12 w-3/4 bg-primary/10 rounded-2xl animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 w-full bg-muted rounded-full" />
                        <div className="h-4 w-5/6 bg-muted rounded-full" />
                        <div className="h-4 w-4/6 bg-muted rounded-full" />
                      </div>
                      <div className="pt-8 flex justify-end">
                        <div className="w-32 h-10 bg-primary/20 rounded-xl" />
                      </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 blur-3xl rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 灵活收纳 SECTION */}
        <section className="py-32 px-6 bg-muted/20 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-border/0 via-border to-border/0" />
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="aspect-[16/10] bg-card/40 backdrop-blur-md border border-border/50 rounded-[3rem] p-8 relative overflow-hidden group shadow-2xl">
                  <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:30px_30px]" />
                  <div className="relative h-full flex items-center justify-center">
                    <div className="relative w-full max-w-md">
                      <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/20 rounded-2xl rotate-12 animate-pulse" />
                      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
                      <div className="relative space-y-4">
                        <div className="p-4 bg-background/80 backdrop-blur-md rounded-2xl border border-border shadow-sm flex items-center gap-4 group-hover:translate-x-4 transition-transform duration-700">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <LayoutGrid className="w-5 h-5" />
                          </div>
                          <div className="h-4 w-32 bg-muted rounded-full" />
                        </div>
                        <div className="p-4 bg-background/80 backdrop-blur-md rounded-2xl border border-border shadow-sm flex items-center gap-4 translate-x-8 group-hover:translate-x-12 transition-transform duration-700 delay-100">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <Zap className="w-5 h-5" />
                          </div>
                          <div className="h-4 w-40 bg-muted rounded-full" />
                        </div>
                        <div className="p-4 bg-background/80 backdrop-blur-md rounded-2xl border border-border shadow-sm flex items-center gap-4 translate-x-4 group-hover:translate-x-8 transition-transform duration-700 delay-200">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="h-4 w-24 bg-muted rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 space-y-8 order-1 lg:order-2">
                <div className="text-center lg:text-left space-y-4">
                  <h2 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
                    灵活收纳
                  </h2>
                  <p className="text-xl text-muted-foreground font-semibold leading-relaxed">
                    导航栏极度灵活，
                    <br className="hidden sm:block" />
                    自由地整理和收纳你的笔记。
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="group p-6 bg-card/40 backdrop-blur-md rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-500">
                    <h3 className="text-xl font-bold tracking-tight mb-2">高度可定制</h3>
                    <p className="text-muted-foreground font-medium">
                      导航栏中的条目可以设置为一个频道，将指定特征的笔记整理在一起，也可以直接指向一篇特定的笔记。
                    </p>
                  </div>
                  <div className="group p-6 bg-card/40 backdrop-blur-md rounded-2xl border border-border/50 hover:border-primary/50 transition-all duration-500">
                    <h3 className="text-xl font-bold tracking-tight mb-2">自由聚合</h3>
                    <p className="text-muted-foreground font-medium">
                      你可以将不同的条目指向同一个笔记，也可以将同一个笔记收纳到任意频道中。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="py-40 px-6">
          <div className="max-w-5xl mx-auto text-center space-y-12">
            <h2 className="text-5xl sm:text-8xl font-black tracking-tighter leading-[0.9] text-balance">
              准备好开始了吗
            </h2>
            <p className="text-xl text-muted-foreground font-semibold max-w-2xl mx-auto opacity-80">
              把每一个闪现的火花都妥善安置
              <br />
              Time Note 期待与你的灵感相遇
            </p>
            <div className="pt-4">
              <Link to="/s/list">
                <Button
                  size="lg"
                  className="h-20 rounded-[2rem] text-2xl px-16 font-black gap-4 shadow-2xl shadow-primary/20 hover:scale-105 hover:shadow-primary/40 transition-all duration-500"
                >
                  创建第一个笔记本 <ArrowRight className="w-8 h-8" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-20 px-6 bg-background/50 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-12">
            <div className="space-y-4">
              <Link to="/" className="flex items-center gap-3">
                <img src="/logo.svg" alt="Logo" className="w-7 h-7" />
                <span className="text-lg font-black tracking-tighter uppercase">Time Note</span>
              </Link>
              <p className="text-sm font-bold text-muted-foreground/60 max-w-xs">
                Built with passion for thinkers.
                <br />
                记录不仅仅是记录，更是与自己对话的过程。
              </p>
            </div>

            <div className="flex flex-wrap gap-8 items-center">
              <button
                type="button"
                onClick={copyEmail}
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Mail className="w-4 h-4 text-primary" /> Email
              </button>
              <a
                href="https://github.com/linchen1987/timenote"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Github className="w-4 h-4 text-primary" /> GitHub
              </a>
              <a
                href="https://link1987.site"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
              >
                <Globe className="w-4 h-4 text-primary" /> Author
              </a>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-border/10 flex justify-between items-center">
            <p className="text-[10px] font-black tracking-widest text-muted-foreground/30 uppercase">
              © 2026 Time Note. All rights reserved.
            </p>
            <span className="text-[10px] font-black tracking-widest text-muted-foreground/20 uppercase">
              Designed with ❤️ for clarity
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
