import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';
import { getUserInfo } from '@/lib/user';

export default async function ClientsPage() {
	const user = await getUserInfo();

	if (!user) {
		redirect('/login');
	}

	const allowed = await hasPermission('clients.read', user.id);
	if (!allowed) {
		redirect('/dashboard');
	}

	return (
		<div className="flex flex-1 flex-col gap-6">
			<div>
				<h1 className="text-2xl font-bold text-foreground">Clients</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage client records and their property relationships.
				</p>
			</div>
		</div>
	);
}
