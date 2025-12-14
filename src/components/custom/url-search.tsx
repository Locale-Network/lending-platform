'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { useDebounce } from 'use-debounce';

export default function Search() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [search, setSearch] = useState('');
  const [path] = useDebounce(search, 300);

  useEffect(() => {
    if (!path) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (path) {
      params.set('query', path);
    } else {
      params.delete('query');
    }
    replace(`${pathname}?${params.toString()}`);
  }, [path, pathname, replace, searchParams]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value);
  }

  return (
    <Input
      placeholder="Search"
      value={search}
      onChange={handleChange}
      className="max-w-sm"
      defaultValue={searchParams.get('query')?.toString()}
    />
  );
}
