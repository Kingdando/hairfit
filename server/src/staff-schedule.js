function dayWindow(date, opening, closing) {
  const start = opening ? `${date} ${opening.slice(0,5)}:00` : `${date} 00:00:00`;
  const next = new Date(`${date}T00:00:00Z`); next.setUTCDate(next.getUTCDate()+1);
  const endDate = !closing || (opening && closing <= opening) ? next.toISOString().slice(0,10) : date;
  const end = closing ? `${endDate} ${closing.slice(0,5)}:00` : `${endDate} 00:00:00`;
  return {start,end};
}
function freeIntervals(start,end,bookings) {
  let cursor=start; const free=[];
  for (const booking of [...bookings].sort((a,b)=>a.start.localeCompare(b.start))) {
    if (booking.end<=cursor || booking.start>=end) continue;
    if (booking.start>cursor) free.push({start:cursor,end:booking.start<end ? booking.start:end});
    if (booking.end>cursor) cursor=booking.end;
  }
  if (cursor<end) free.push({start:cursor,end});
  return free;
}
function registerStaffSchedule(app,pool,authenticateOptional) {
  app.get('/api/salons/:salonId/staff-schedule',authenticateOptional,async(req,res,next)=>{
    const date=String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date+'T00:00:00Z').getTime()) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date) return res.status(400).json({error:'Choose a valid schedule date.'});
    try {
      const [salons]=await pool.execute('SELECT id,owner_id,opening_time,closing_time FROM salons WHERE id=? AND is_active=TRUE',[req.params.salonId]);
      const salon=salons[0];if (!salon) return res.status(404).json({error:'Salon not found.'});
      const canSeeClients=req.user?.role==='owner' && Number(req.user.sub)===Number(salon.owner_id);
      const window=dayWindow(date,salon.opening_time,salon.closing_time);
      const [staff]=await pool.execute('SELECT st.id,u.full_name AS name,st.is_available AS isAvailable FROM stylists st JOIN users u ON u.id=st.user_id WHERE st.salon_id=? AND st.deleted_at IS NULL ORDER BY u.full_name',[salon.id]);
      // Signed-in clients see first-name labels; only the salon owner sees full names/services.
      const [bookings]=await pool.execute(`SELECT b.stylist_id AS staffId, b.status, (q.booking_id IS NOT NULL) AS isQueued,
        DATE_FORMAT(b.appointment_at,'%Y-%m-%d %H:%i:%s') AS \`start\`,
        DATE_FORMAT(DATE_ADD(b.appointment_at,INTERVAL sv.duration_minutes MINUTE),'%Y-%m-%d %H:%i:%s') AS \`end\`
        ${canSeeClients ? ',u.full_name AS clientName,sv.name AS serviceName' : req.user ? ",SUBSTRING_INDEX(TRIM(u.full_name),' ',1) AS clientLabel" : ''}
        FROM bookings b JOIN services sv ON sv.id=b.service_id LEFT JOIN booking_queue q ON q.booking_id=b.id ${req.user ? 'JOIN users u ON u.id=b.user_id' : ''}
        WHERE sv.salon_id=? AND b.status IN ('pending','confirmed') AND b.appointment_at<?
        AND DATE_ADD(b.appointment_at,INTERVAL sv.duration_minutes MINUTE)>? ORDER BY b.appointment_at`,[salon.id,window.end,window.start]);
      const nowPH=new Date(Date.now()+8*3600000).toISOString().slice(0,19).replace('T',' ');
      const availableStart=window.start>nowPH ? window.start:nowPH;
      const hoursKnown=Boolean(salon.opening_time && salon.closing_time);
      const data=staff.map(member=>{
        const occupied=bookings.filter(b=>Number(b.staffId)===Number(member.id) || (b.staffId===null && b.status==='confirmed'));
        return {...member,bookings:occupied.map(({staffId,...b})=>({...b,unassigned:staffId===null})),
          available:member.isAvailable && hoursKnown ? freeIntervals(availableStart,window.end,occupied.filter(b=>!b.isQueued)):[]};
      });
      res.json({data:{date,openingTime:salon.opening_time,closingTime:salon.closing_time,canSeeClients,staff:data}});
    } catch(error){next(error);}
  });
}
module.exports={registerStaffSchedule,dayWindow,freeIntervals};
