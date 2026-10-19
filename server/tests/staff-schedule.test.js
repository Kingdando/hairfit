const test=require('node:test');
const assert=require('node:assert/strict');
const {dayWindow,freeIntervals,registerStaffSchedule}=require('../src/staff-schedule');
test('merges overlapping bookings and clips free time to operating hours',()=>{
  const start='2099-01-01 09:00:00',end='2099-01-01 18:00:00';
  assert.deepEqual(freeIntervals(start,end,[{start:'2099-01-01 08:00:00',end:'2099-01-01 10:00:00'},{start:'2099-01-01 09:30:00',end:'2099-01-01 11:00:00'},{start:'2099-01-01 14:00:00',end:'2099-01-01 15:00:00'}]),[{start:'2099-01-01 11:00:00',end:'2099-01-01 14:00:00'},{start:'2099-01-01 15:00:00',end}]);
  assert.equal(dayWindow('2099-01-01','20:00:00','02:00:00').end,'2099-01-02 02:00:00');
});
test('schedule endpoint reveals client identities only to the matching salon owner',async()=>{
  for(const user of [undefined,{role:'customer',sub:7},{role:'owner',sub:99},{role:'owner',sub:5}]) {
    let handler,projection;
    registerStaffSchedule({get:(path,middleware,fn)=>{handler=fn;}},{execute:async(sql)=>{
      if(sql.includes('FROM salons'))return [[{id:1,owner_id:5,opening_time:'09:00:00',closing_time:'18:00:00'}]];
      if(sql.includes('FROM stylists'))return [[{id:2,name:'Stylist',isAvailable:1}]];
      projection=sql.includes('u.full_name AS clientName');
      return [[{staffId:2,status:'confirmed',start:'2099-01-01 10:00:00',end:'2099-01-01 11:00:00',...(projection?{clientName:'Test Client',serviceName:'Haircut'}:sql.includes('AS clientLabel')?{clientLabel:'Test'}:{})}]];
    }},()=>{});
    let result;
    await handler({params:{salonId:1},query:{date:'2099-01-01'},user},{json:data=>{result=data;}},error=>{throw error;});
    const owner=user?.role==='owner' && user.sub===5;
    assert.equal(projection,owner);
    assert.equal(result.data.canSeeClients,owner);
    assert.equal(result.data.staff[0].bookings[0].clientName,owner?'Test Client':undefined);
    assert.equal(result.data.staff[0].bookings[0].clientLabel,!owner && user ? 'Test':undefined);
    assert.equal(result.data.staff[0].available.length,2);
  }
});
