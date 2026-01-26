import { ChevronRight, FlaskConical, Globe } from 'lucide-react';
import { Link } from 'react-router';
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

export default function PlaygroundIndex() {
  const experiments = [
    {
      title: 'WebDAV Explorer',
      description: 'Test and explore WebDAV server connections and file structures.',
      href: '/playground/webdav',
      icon: <Globe className="w-6 h-6 text-blue-500" />,
    },
    // 未来可以在这里添加更多
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <FlaskConical className="w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight">Playground</h1>
          </div>
          <p className="text-muted-foreground">
            A place for experimental features and developer tools.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {experiments.map((exp) => (
            <Link key={exp.href} to={exp.href} className="group">
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                        {exp.icon}
                      </div>
                      <CardTitle className="text-xl">{exp.title}</CardTitle>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                  <CardDescription className="pt-2">{exp.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>

        <footer className="pt-12 border-t border-muted text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            ← Back to Notebooks
          </Link>
        </footer>
      </div>
    </div>
  );
}
